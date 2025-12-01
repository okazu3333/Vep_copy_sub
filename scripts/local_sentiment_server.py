import os
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline


class SentimentScores(BaseModel):
  label: str
  score: float


class SentimentResponse(BaseModel):
  method: str
  dominantEmotion: str
  confidence: float
  scores: List[SentimentScores]
  provider: str = 'local'
  model: str
  rawResult: Optional[dict] = None


class SentimentRequest(BaseModel):
  text: str
  model: Optional[str] = None


MODEL_NAME = os.getenv('LOCAL_SENTIMENT_MODEL', 'daigo/bert-base-japanese-sentiment')
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
classifier = pipeline('sentiment-analysis', model=model, tokenizer=tokenizer, return_all_scores=True)

app = FastAPI(title='Local Sentiment API', version='1.0.0')


@app.post('/api/sentiment', response_model=SentimentResponse)
async def analyze_sentiment(body: SentimentRequest):
  text = body.text.strip()
  if not text:
    raise HTTPException(status_code=400, detail='text is required')

  try:
    results = classifier(text)
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f'sentiment inference failed: {exc}') from exc

  if not results:
    raise HTTPException(status_code=500, detail='empty result from classifier')

  scores = results[0]
  dominant = max(scores, key=lambda item: item['score'])

  response = SentimentResponse(
    method='transformers_pipeline',
    dominantEmotion=dominant['label'],
    confidence=float(dominant['score']),
    scores=[SentimentScores(label=item['label'], score=float(item['score'])) for item in scores],
    provider='local',
    model=MODEL_NAME,
    rawResult={'scores': scores},
  )
  return response


if __name__ == '__main__':
  import uvicorn

  uvicorn.run(
    'scripts.local_sentiment_server:app',
    host='0.0.0.0',
    port=int(os.getenv('LOCAL_SENTIMENT_PORT', '8000')),
    reload=False,
  )
