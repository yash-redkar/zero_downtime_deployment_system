VERSION ?= latest

V1_IMAGE = smartdeploy-v1
V2_IMAGE = smartdeploy-v2

package:
	docker build -t $(V1_IMAGE):$(VERSION) ./app/v1
	docker build -t $(V2_IMAGE):$(VERSION) ./app/v2
	docker save $(V1_IMAGE):$(VERSION) -o $(V1_IMAGE)-$(VERSION).tar
	docker save $(V2_IMAGE):$(VERSION) -o $(V2_IMAGE)-$(VERSION).tar