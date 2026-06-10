# SmartDeploy - Zero Downtime Deployment System

SmartDeploy is a DevOps capstone project that demonstrates blue-green and canary deployment concepts using Docker, Kubernetes, GitHub Actions, Prometheus, and YAML.

## Current Initial Phase

Completed:

- Created v1 stable application
- Created v2 canary application
- Added Dockerfile for both versions
- Added Docker Compose to run both versions locally
- Added GitHub Actions CI pipeline
- Created dashboard prototype

## Application Versions

### v1 Stable

Runs on:

```bash
http://localhost:5001
```

### v2 Canary

Runs on:
 ```bash
http://localhost:5002
```