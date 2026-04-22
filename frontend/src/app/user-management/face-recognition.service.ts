import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';

@Injectable({
    providedIn: 'root'
})
export class FaceRecognitionService {
    private modelsLoaded = false;

    async loadModels() {
        if (this.modelsLoaded) return;

        const MODEL_URL = '/assets/models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        this.modelsLoaded = true;
    }

    async detectFace(videoElement: HTMLVideoElement) {
        if (!this.modelsLoaded) await this.loadModels();

        // Check if video is playing and has frames ready
        if (videoElement.paused || videoElement.ended || videoElement.readyState < 2) {
            return null;
        }

        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.3
        });
        const detection = await faceapi.detectSingleFace(videoElement, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

        return detection;
    }

    async getFaceDescriptorFromImage(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
        if (!this.modelsLoaded) await this.loadModels();

        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.3
        });

        const detection = await faceapi.detectSingleFace(imageElement, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

        return detection ? detection.descriptor : null;
    }
}
