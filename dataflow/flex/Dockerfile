FROM gcr.io/dataflow-templates-base/python3-template-launcher-base:latest

WORKDIR /dataflow/template
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pipelines
COPY mbox_mime_pipeline.py .
COPY scoring_pipeline.py .

# Default entry
ENV FLEX_TEMPLATE_PYTHON_PY_FILE=/dataflow/template/scoring_pipeline.py

# Entrypoint is provided by the base image 