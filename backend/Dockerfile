FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libgobject-2.0-0 libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libffi8 \
	&& rm -rf /var/lib/apt/lists/* \
	&& pip install --no-cache-dir -r requirements.txt

COPY backend ./backend

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]