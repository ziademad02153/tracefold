FROM python:3.11-slim@sha256:db20d8506e2f15b6db39b40b6015ca46bae855dec6dd326d462cfe79ae972893
RUN pip install --no-cache-dir pytest==8.3.5
ENV PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
WORKDIR /workspace
USER 65534:65534
CMD ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider"]
