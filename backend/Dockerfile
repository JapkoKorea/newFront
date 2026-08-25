# 잽코 택시투어 API 서버
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 의존성만 먼저 복사해 레이어 캐시를 활용한다.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY . .

# 컨테이너 내부 포트. 외부 노출 포트는 compose 에서 매핑한다.
EXPOSE 8000

# 프로덕션에서는 reload 를 켜지 않는다.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
