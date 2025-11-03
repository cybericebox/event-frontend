buildAndPush:
	docker build -f deploy/Dockerfile .  --platform=linux/amd64 -t cybericebox/event-frontend:$(tag) && docker push cybericebox/event-frontend:$(tag)