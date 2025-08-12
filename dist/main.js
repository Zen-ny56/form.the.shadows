import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Ray } from "@babylonjs/core/Culling/ray";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Sound } from "@babylonjs/core/Audio/sound.js";
import "@babylonjs/loaders/glTF"; // Required for loading .glb/.gltf
import { GUIManager } from "./gui-manager.js";
class GLBScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.cameraLocked = false;
        this.ballVelocity = new Vector3(0.3, 0, 0.2); // Ball velocity in X and Z directions
        this.ballSpeed = 0.4; // Base ball speed
        this.isPaused = false; // Game pause state
        // Audio System Properties
        this.audioContext = null;
        this.boundaryHitSound = null;
        this.ballPaddleHitSound = null;
        this.ballWallBounceSound = null;
        this.scoreSound = null;
        this.pauseSound = null;
        this.lastBoundaryHitTime = 0;
        this.lastBallHitTime = 0;
        this.boundaryHitCooldown = 200; // ms between sounds
        this.ballHitCooldown = 100; // ms between ball hit sounds
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
        this.guiManager = new GUIManager();
        this.setupCamera();
        this.setupLighting();
        this.setupCustomMaterials();
        this.setupResizeListener();
        this.setupAudio();
        this.setupScene();
    }
    setupResizeListener() {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }
    setupAudio() {
        try {
            // Initialize Web Audio Context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("🔊 Audio context initialized");
            // Handle browser autoplay policies - audio context may start suspended
            if (this.audioContext.state === 'suspended') {
                console.log("🔊 Audio context is suspended, will resume on first user interaction");
                // Set up one-time user interaction listener to unlock audio
                const unlockAudio = () => {
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume().then(() => {
                            console.log("🔊 Audio context resumed successfully");
                            // Remove the audio prompt once audio is activated
                            const audioPrompt = document.getElementById('audioPrompt');
                            if (audioPrompt) {
                                audioPrompt.style.display = 'none';
                            }
                        });
                    }
                    // Remove the listener after first use
                    document.removeEventListener('click', unlockAudio);
                    document.removeEventListener('keydown', unlockAudio);
                };
                document.addEventListener('click', unlockAudio);
                document.addEventListener('keydown', unlockAudio);
            }
            // Generate and create sound effects
            this.createSoundEffects();
            // Setup test audio button
            this.setupTestAudioButton();
        }
        catch (error) {
            console.warn("⚠️ Audio initialization failed:", error);
            console.warn("⚠️ Audio features will be disabled");
        }
    }
    createSoundEffects() {
        if (!this.audioContext)
            return;
        // Instead of complex Babylon.js Sound objects, we'll use direct Web Audio API
        // This eliminates the blob conversion issues
        console.log("🔊 Setting up direct Web Audio API sound system");
        console.log("🔊 All sound effects ready (using direct Web Audio API)");
    }
    createBeepSound(frequency, duration, volume) {
        // Create a simple beep using Web Audio API and convert to Babylon.js Sound
        const sampleRate = 44100;
        const numSamples = sampleRate * duration;
        const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        // Generate sine wave with envelope
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin(Math.PI * t / duration); // Simple envelope
            channelData[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * volume;
        }
        // Convert to WAV blob and create Babylon.js Sound
        const wavBlob = this.audioBufferToWav(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        return new Sound("beep", url, this.scene, null, {
            volume: volume,
            playbackRate: 1.0,
            loop: false
        });
    }
    createChordSound(frequencies, duration, volume) {
        const sampleRate = 44100;
        const numSamples = sampleRate * duration;
        const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        // Generate chord (multiple frequencies)
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope = Math.sin(Math.PI * t / duration); // Simple envelope
            let sample = 0;
            frequencies.forEach(freq => {
                sample += Math.sin(2 * Math.PI * freq * t) / frequencies.length;
            });
            channelData[i] = sample * envelope * volume;
        }
        const wavBlob = this.audioBufferToWav(audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        return new Sound("chord", url, this.scene, null, {
            volume: volume,
            playbackRate: 1.0,
            loop: false
        });
    }
    audioBufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataLength = audioBuffer.length * blockAlign;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);
        // Convert float samples to PCM
        const channelData = audioBuffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < channelData.length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
        return new Blob([buffer], { type: 'audio/wav' });
    }
    playBoundaryHitSound() {
        const currentTime = Date.now();
        // Prevent sound spam by using cooldown
        if (currentTime - this.lastBoundaryHitTime < this.boundaryHitCooldown) {
            return;
        }
        this.playDirectBeep(800, 0.1, 0.3); // Sharp beep: 800Hz, 0.1s, 30% volume
        this.lastBoundaryHitTime = currentTime;
        console.log("🔊 Boundary hit sound played");
    }
    playBallHitSound() {
        const currentTime = Date.now();
        // Prevent sound spam by using cooldown
        if (currentTime - this.lastBallHitTime < this.ballHitCooldown) {
            return;
        }
        this.playDirectBeep(400, 0.15, 0.4); // Pong sound: 400Hz, 0.15s, 40% volume
        this.lastBallHitTime = currentTime;
        console.log("🔊 Ball hit paddle sound played");
    }
    playBallWallBounceSound() {
        this.playDirectBeep(600, 0.1, 0.25); // Wall bounce: 600Hz, 0.1s, 25% volume
        console.log("🔊 Ball wall bounce sound played");
    }
    playScoreSound() {
        this.playDirectChord([523, 659, 784], 0.8, 0.5); // Score chord: C-E-G, 0.8s, 50% volume
        console.log("🔊 Score sound played");
    }
    playPauseSound() {
        this.playDirectBeep(200, 0.2, 0.2); // Pause tone: 200Hz, 0.2s, 20% volume
        console.log("🔊 Pause sound played");
    }
    setupTestAudioButton() {
        // Setup test audio button after page load
        setTimeout(() => {
            const testBtn = document.getElementById('testAudioBtn');
            if (testBtn) {
                testBtn.addEventListener('click', () => {
                    console.log("🔊 Testing all audio sounds...");
                    // First test a simple Web Audio API beep
                    this.testSimpleBeep();
                    // Test all sounds with delays
                    setTimeout(() => this.playBoundaryHitSound(), 500);
                    setTimeout(() => this.playBallHitSound(), 1000);
                    setTimeout(() => this.playBallWallBounceSound(), 1500);
                    setTimeout(() => this.playScoreSound(), 2000);
                    setTimeout(() => this.playPauseSound(), 3000);
                    console.log("🔊 Audio test sequence started - check console for sound messages");
                });
            }
        }, 1000);
    }
    testSimpleBeep() {
        // Test a simple direct Web Audio API beep
        if (!this.audioContext) {
            console.log("⚠️ No audio context available");
            return;
        }
        try {
            console.log("🔊 Testing simple Web Audio API beep...");
            console.log("🔊 Audio context state:", this.audioContext.state);
            // Create a simple oscillator
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
            console.log("🔊 Simple beep test - should hear a 440Hz tone");
        }
        catch (error) {
            console.error("⚠️ Simple beep test failed:", error);
        }
    }
    playDirectBeep(frequency, duration, volume) {
        if (!this.audioContext)
            return;
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';
            // Create envelope for more natural sound
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        }
        catch (error) {
            console.warn("⚠️ Failed to play beep:", error);
        }
    }
    playDirectChord(frequencies, duration, volume) {
        if (!this.audioContext)
            return;
        try {
            // Play multiple frequencies simultaneously to create a chord
            frequencies.forEach(frequency => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                oscillator.type = 'sine';
                // Reduce volume per oscillator to prevent clipping
                const adjustedVolume = volume / frequencies.length;
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(adjustedVolume, this.audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + duration);
            });
        }
        catch (error) {
            console.warn("⚠️ Failed to play chord:", error);
        }
    }
    setupCamera() {
        // Create ArcRotateCamera with your desired exact position
        const camera = new ArcRotateCamera("camera", -1.569, 0.593, 43.461, Vector3.Zero(), this.scene);
        // Lock the camera - disable all controls
        camera.attachControl(this.canvas, false); // false = no control attachment
        // Disable all camera movements
        camera.inputs.clear(); // Remove all input handlers
        this.scene.activeCamera = camera;
        console.log("📷 Camera locked at desired position");
    }
    // Alternative: Set specific camera position immediately during setup
    setCameraToImageOnePosition() {
        const camera = this.scene.activeCamera;
        if (!camera)
            return;
        // Based on your first image, it looks like you want a more elevated, angled view
        // Try these values (adjust as needed):
        camera.setTarget(new Vector3(0, 0, 0)); // Look at center of game area
        camera.alpha = -Math.PI / 4; // 45 degrees from side
        camera.beta = Math.PI / 3; // More elevated angle
        camera.radius = 12; // Slightly further back
        console.log("📷 Camera positioned for Image 1 style view");
    }
    positionObjectsAtCoordinates() {
        // Define object positions based on the exact mesh names and coordinates you provided
        const objectPositions = {
            'paddleLeft': new Vector3(-20.28, 1.00, 0.00),
            'pongBall': new Vector3(0.00, 0.78, 0.00),
            'centreLine': new Vector3(0.00, 0.05, 0.00),
            'paddleRight': new Vector3(20.28, 1.00, 0.00),
            'floorPlane': new Vector3(0.00, 0.00, 0.00)
        };
        // Position each specific mesh by finding it in the scene
        Object.keys(objectPositions).forEach(meshName => {
            const mesh = this.scene.getMeshByName(meshName);
            if (mesh) {
                const pos = objectPositions[meshName];
                mesh.position.copyFrom(pos);
                console.log(`📍 Positioned ${meshName} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
            }
            else {
                console.warn(`⚠️ Mesh not found in GLB: ${meshName}`);
            }
        });
    }
    // private lockCameraToObjectCoordinates(): void {
    //     const camera = this.scene.activeCamera as ArcRotateCamera;
    //     // Lock camera to center of the game area where objects are positioned
    //     // Objects span from x: -20.28 to 20.28, centered at y: 0.78 (ball height)
    //     camera.setTarget(new Vector3(0, 0.78, 0)); // Center of the game area
    //     camera.alpha = Math.PI / 2; // 90 degree rotation to make paddles left/right
    //     camera.beta = 0; // Top-down view (straight down)
    //     camera.radius = 43; // Zoomed in closer to the playing field
    //     // Disable camera controls to lock it in place
    //     camera.detachControl();
    //     console.log("📹 Camera locked to top-down view - paddles left/right");
    //     console.log("📹 Camera target: (0.00, 0.78, 0.00) - Center of game area");
    // }
    setupInteractiveCoordinateDisplay() {
        // Add click event to display object coordinates
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh) {
                const mesh = pointerInfo.pickInfo.pickedMesh;
                const pos = mesh.position;
                console.log(`🎯 Clicked: ${mesh.name} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
                // Display on webpage
                this.displayCoordinateOnPage(mesh.name, pos);
            }
        });
        // Add keyboard shortcut to log all coordinates
        window.addEventListener('keydown', (event) => {
            // Skip keyboard shortcuts when paused (except escape which is handled elsewhere)
            if (this.isPaused && event.key !== 'Escape')
                return;
            if (event.key === 'c' || event.key === 'C') {
                this.logAllObjectCoordinates();
            }
        });
    }
    displayCoordinateOnPage(meshName, position) {
        this.guiManager.displayCoordinateOnPage(meshName, position);
    }
    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.guiManager.createPauseMenu();
            this.playPauseSound();
            console.log("⏸️ Game paused - Press ESC to resume");
        }
        else {
            this.guiManager.removePauseMenu();
            this.playPauseSound();
            console.log("▶️ Game resumed");
        }
    }
    setupPaddleControls() {
        const inputMap = {};
        // Check if paddles exist
        const leftPaddle = this.scene.getMeshByName('paddleLeft');
        const rightPaddle = this.scene.getMeshByName('paddleRight');
        console.log("🎮 Setting up paddle controls:");
        console.log("  Left paddle found:", !!leftPaddle);
        console.log("  Right paddle found:", !!rightPaddle);
        if (!leftPaddle || !rightPaddle) {
            console.error("❌ Paddles not found in scene! Available meshes:");
            this.scene.meshes.forEach(mesh => {
                console.log(`  - ${mesh.name}`);
            });
            return;
        }
        // Track key states
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            inputMap[key] = true;
            console.log(`🔽 Key pressed: ${key}`);
            // Handle pause toggle with Escape key
            if (event.key === 'Escape') {
                this.togglePause();
                return; // Don't process other inputs when toggling pause
            }
            // Handle camera lock toggle
            if (key === 'l') {
                this.toggleCameraLock();
            }
        });
        window.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            inputMap[key] = false;
            console.log(`🔼 Key released: ${key}`);
        });
        // Update paddles each frame
        this.scene.registerBeforeRender(() => {
            // Skip updates if game is paused
            if (this.isPaused)
                return;
            const leftPaddle = this.scene.getMeshByName('paddleLeft');
            const rightPaddle = this.scene.getMeshByName('paddleRight');
            if (leftPaddle) {
                let leftInput = 0;
                if (inputMap['a'])
                    leftInput -= 1; // Left on Z-axis
                if (inputMap['d'])
                    leftInput += 1; // Right on Z-axis
                if (leftInput !== 0) {
                    console.log(`⬅️ Left paddle input: ${leftInput}`);
                }
                this.updatePaddlePosition(leftPaddle, leftInput);
            }
            if (rightPaddle) {
                let rightInput = 0;
                if (inputMap['arrowright'])
                    rightInput -= 1; // Right on Z-axis
                if (inputMap['arrowleft'])
                    rightInput += 1; // Left on Z-axis
                if (rightInput !== 0) {
                    console.log(`➡️ Right paddle input: ${rightInput}`);
                }
                this.updatePaddlePosition(rightPaddle, rightInput);
            }
        });
        console.log("🎮 Paddle controls initialized! Use A/D for left, Arrow Left/Right for right");
        console.log("📹 Camera controls: Press 'L' to lock/unlock camera");
    }
    toggleCameraLock() {
        const camera = this.scene.activeCamera;
        if (!this.cameraLocked) {
            // Lock camera to ideal 3D viewing angle
            this.lockCameraToIdealView();
            this.cameraLocked = true;
            console.log("📹 Camera LOCKED - Press 'L' to unlock");
        }
        else {
            // Unlock camera - restore controls
            camera.attachControl(this.canvas, true);
            this.cameraLocked = false;
            console.log("📹 Camera UNLOCKED - Press 'L' to lock");
        }
    }
    lockCameraToIdealView() {
        const camera = this.scene.activeCamera;
        // Find game center for camera target
        const gameCenter = new Vector3(0, 0.78, 0); // Center of game area at ball height
        // Set ideal 3D viewing angle - slightly elevated and angled
        camera.setTarget(gameCenter);
        camera.alpha = Math.PI / 2; // 90 degrees - looking across the field
        camera.beta = Math.PI / 3; // 60 degrees - elevated view for nice 3D perspective
        camera.radius = 35; // Distance from target - close enough to see action
        // Disable camera controls when locked
        camera.detachControl();
        console.log("📹 Camera locked to ideal 3D view:");
        console.log(`  Target: (${gameCenter.x}, ${gameCenter.y}, ${gameCenter.z})`);
        console.log(`  Alpha: ${(camera.alpha * 180 / Math.PI).toFixed(1)}°`);
        console.log(`  Beta: ${(camera.beta * 180 / Math.PI).toFixed(1)}°`);
        console.log(`  Distance: ${camera.radius}`);
    }
    createInvisibleWalls() {
        const floorPlane = this.scene.getMeshByName('floorPlane');
        if (!floorPlane) {
            console.warn("⚠️ Floor plane not found, using default boundaries");
            return;
        }
        console.log("🚧 Creating invisible walls at floor edges...");
        // Force bounding box recalculation to get current world coordinates
        floorPlane.computeWorldMatrix(true);
        floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
        const boundingInfo = floorPlane.getBoundingInfo();
        const boundingBox = boundingInfo.boundingBox;
        // Get floor dimensions and position
        const floorMinZ = boundingBox.minimumWorld.z;
        const floorMaxZ = boundingBox.maximumWorld.z;
        const floorMinX = boundingBox.minimumWorld.x;
        const floorMaxX = boundingBox.maximumWorld.x;
        const floorY = boundingBox.maximumWorld.y; // Top surface of floor
        console.log(`🚧 Floor bounds - Z: ${floorMinZ.toFixed(2)} to ${floorMaxZ.toFixed(2)}, X: ${floorMinX.toFixed(2)} to ${floorMaxX.toFixed(2)}`);
        // Wall dimensions
        const wallHeight = 5.0; // High enough for paddles
        const wallThickness = 0.1; // Thin walls
        const wallWidth = Math.abs(floorMaxX - floorMinX) + 2; // Cover full floor width plus buffer
        // Create forward wall (at maxZ edge)
        const forwardWall = MeshBuilder.CreateBox("forwardWall", {
            width: wallWidth,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        // Position at forward edge of floor, snapped to surface
        forwardWall.position = new Vector3((floorMinX + floorMaxX) / 2, // Center X
        floorY + (wallHeight / 2), // Bottom at floor surface
        floorMaxZ + (wallThickness / 2) // Just outside floor edge
        );
        // Create backward wall (at minZ edge)
        const backwardWall = MeshBuilder.CreateBox("backwardWall", {
            width: wallWidth,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        // Position at backward edge of floor, snapped to surface
        backwardWall.position = new Vector3((floorMinX + floorMaxX) / 2, // Center X
        floorY + (wallHeight / 2), // Bottom at floor surface
        floorMinZ - (wallThickness / 2) // Just outside floor edge
        );
        // Make walls invisible but still detectable by raycasting
        const invisibleMaterial = new StandardMaterial("invisibleWallMaterial", this.scene);
        invisibleMaterial.alpha = 0.0; // Completely transparent
        invisibleMaterial.disableLighting = true;
        forwardWall.material = invisibleMaterial;
        backwardWall.material = invisibleMaterial;
        // Make walls pickable for raycasting but not for mouse clicks
        forwardWall.isPickable = true;
        backwardWall.isPickable = true;
        forwardWall.checkCollisions = false;
        backwardWall.checkCollisions = false;
        console.log(`🚧 Created invisible walls:`);
        console.log(`  Forward wall at Z: ${forwardWall.position.z.toFixed(2)} (boundary: ${floorMaxZ.toFixed(2)})`);
        console.log(`  Backward wall at Z: ${backwardWall.position.z.toFixed(2)} (boundary: ${floorMinZ.toFixed(2)})`);
        console.log(`✅ Invisible walls created and snapped to floor edges`);
    }
    updatePaddlePosition(paddle, inputDirection) {
        if (inputDirection === 0)
            return; // No movement needed
        const moveSpeed = 0.2;
        const oldZ = paddle.position.z;
        // Get paddle dimensions first
        paddle.computeWorldMatrix(true);
        paddle.getBoundingInfo().update(paddle.getWorldMatrix());
        const paddleBounds = paddle.getBoundingInfo().boundingBox;
        // Calculate paddle dimensions
        const paddleWidth = Math.abs(paddleBounds.maximumWorld.x - paddleBounds.minimumWorld.x);
        const paddleHeight = Math.abs(paddleBounds.maximumWorld.y - paddleBounds.minimumWorld.y);
        const paddleDepth = Math.abs(paddleBounds.maximumWorld.z - paddleBounds.minimumWorld.z);
        // Calculate new intended position
        const moveDirection = new Vector3(0, 0, inputDirection * moveSpeed);
        const intendedNewPosition = paddle.position.add(moveDirection);
        console.log(`🎯 ${paddle.name} attempting move: ${oldZ.toFixed(2)} → ${intendedNewPosition.z.toFixed(2)} (input: ${inputDirection})`);
        console.log(`📏 Paddle dimensions - Width: ${paddleWidth.toFixed(2)}, Height: ${paddleHeight.toFixed(2)}, Depth: ${paddleDepth.toFixed(2)}`);
        // Cast rays from CURRENT paddle position, not intended position
        // This prevents premature collision detection
        const currentLeadingEdgeZ = inputDirection > 0 ?
            paddle.position.z + (paddleDepth / 2) : // Current front edge
            paddle.position.z - (paddleDepth / 2); // Current back edge
        console.log(`🎯 Casting rays from current leading edge at Z: ${currentLeadingEdgeZ.toFixed(2)}`);
        // Create ray starting positions at the CURRENT leading edge of the paddle
        const rayStartPositions = [
            // Center of current leading edge
            new Vector3(paddle.position.x, paddle.position.y, currentLeadingEdgeZ),
            // Left and right edges of paddle at current leading face
            new Vector3(paddle.position.x - (paddleWidth / 2) + 0.1, paddle.position.y, currentLeadingEdgeZ),
            new Vector3(paddle.position.x + (paddleWidth / 2) - 0.1, paddle.position.y, currentLeadingEdgeZ),
            // Top and bottom edges at current leading face
            new Vector3(paddle.position.x, paddle.position.y + (paddleHeight / 2) - 0.1, currentLeadingEdgeZ),
            new Vector3(paddle.position.x, paddle.position.y - (paddleHeight / 2) + 0.1, currentLeadingEdgeZ),
            // Corner points of current leading face
            new Vector3(paddle.position.x - (paddleWidth / 2) + 0.1, paddle.position.y + (paddleHeight / 2) - 0.1, currentLeadingEdgeZ),
            new Vector3(paddle.position.x + (paddleWidth / 2) - 0.1, paddle.position.y + (paddleHeight / 2) - 0.1, currentLeadingEdgeZ),
            new Vector3(paddle.position.x + (paddleWidth / 2) - 0.1, paddle.position.y - (paddleHeight / 2) + 0.1, currentLeadingEdgeZ)
        ];
        // Ray direction: continue in movement direction from current leading edge
        const rayDirection = new Vector3(0, 0, inputDirection).normalize();
        const rayDistance = moveSpeed + 0.01; // Just slightly more than move distance
        let collisionDetected = false;
        let closestDistance = Infinity;
        let hitWallName = "";
        // Enable ray visualization for debugging
        // this.debugVisualizeRays(rayStartPositions, rayDirection, rayDistance);
        // Cast rays from all positions on the leading edge
        rayStartPositions.forEach((rayStart, index) => {
            const ray = new Ray(rayStart, rayDirection, rayDistance);
            const hit = this.scene.pickWithRay(ray);
            if (hit?.hit && hit.pickedMesh &&
                (hit.pickedMesh.name === "forwardWall" || hit.pickedMesh.name === "backwardWall")) {
                collisionDetected = true;
                if (hit.distance < closestDistance) {
                    closestDistance = hit.distance;
                    hitWallName = hit.pickedMesh.name;
                }
                console.log(`🔍 Ray ${index} from leading edge hit ${hit.pickedMesh.name} at distance ${hit.distance.toFixed(3)}`);
            }
        });
        // Alternative approach: Check if the paddle would go beyond floor edges
        if (!collisionDetected) {
            // Get floor bounds for precise edge detection
            const floorPlane = this.scene.getMeshByName('floorPlane');
            if (floorPlane) {
                floorPlane.computeWorldMatrix(true);
                floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
                const floorBounds = floorPlane.getBoundingInfo().boundingBox;
                // Calculate where the leading edge WOULD BE after the move
                const newLeadingEdgeZ = inputDirection > 0 ?
                    intendedNewPosition.z + (paddleDepth / 2) : // Moving forward: front edge after move
                    intendedNewPosition.z - (paddleDepth / 2); // Moving backward: back edge after move
                // Use minimal buffer - just enough to keep paddle on the floor surface
                const minimalBuffer = 0.01; // Even smaller buffer for precise edge alignment
                const maxFloorZ = floorBounds.maximumWorld.z - minimalBuffer;
                const minFloorZ = floorBounds.minimumWorld.z + minimalBuffer;
                console.log(`🏢 Floor Z bounds: ${minFloorZ.toFixed(3)} to ${maxFloorZ.toFixed(3)} (buffer: ${minimalBuffer})`);
                console.log(`🎯 Leading edge would be at: ${newLeadingEdgeZ.toFixed(3)} after move`);
                // Check if leading edge would go beyond floor boundaries AFTER the move
                if (inputDirection > 0 && newLeadingEdgeZ > maxFloorZ) {
                    // Moving forward: check if leading edge exceeds floor
                    collisionDetected = true;
                    hitWallName = "forwardWall";
                    console.log(`🚧 ${paddle.name} leading edge would exceed floor: ${newLeadingEdgeZ.toFixed(3)} > ${maxFloorZ.toFixed(3)}`);
                }
                else if (inputDirection < 0 && newLeadingEdgeZ < minFloorZ) {
                    // Moving backward: check if leading edge exceeds floor  
                    collisionDetected = true;
                    hitWallName = "backwardWall";
                    console.log(`🚧 ${paddle.name} leading edge would exceed floor: ${newLeadingEdgeZ.toFixed(3)} < ${minFloorZ.toFixed(3)}`);
                }
            }
        }
        // If still no collision detected, do a final precise boundary check
        if (!collisionDetected) {
            const floorPlane = this.scene.getMeshByName('floorPlane');
            if (floorPlane) {
                floorPlane.computeWorldMatrix(true);
                floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
                const floorBounds = floorPlane.getBoundingInfo().boundingBox;
                // Check if ANY part of the paddle would go off the floor
                const paddleBackEdge = inputDirection > 0 ?
                    intendedNewPosition.z - (paddleDepth / 2) : // Moving forward: check back edge stays on
                    intendedNewPosition.z + (paddleDepth / 2); // Moving backward: check back edge stays on
                const paddleFrontEdge = inputDirection > 0 ?
                    intendedNewPosition.z + (paddleDepth / 2) : // Moving forward: check front edge doesn't exceed
                    intendedNewPosition.z - (paddleDepth / 2); // Moving backward: check front edge doesn't exceed
                // Ensure entire paddle stays within floor bounds
                if (paddleFrontEdge > floorBounds.maximumWorld.z ||
                    paddleFrontEdge < floorBounds.minimumWorld.z ||
                    paddleBackEdge > floorBounds.maximumWorld.z ||
                    paddleBackEdge < floorBounds.minimumWorld.z) {
                    collisionDetected = true;
                    hitWallName = inputDirection > 0 ? "forwardWall" : "backwardWall";
                    console.log(`🚧 ${paddle.name} would partially leave floor - front: ${paddleFrontEdge.toFixed(2)}, back: ${paddleBackEdge.toFixed(2)}`);
                    console.log(`🚧 Floor bounds: ${floorBounds.minimumWorld.z.toFixed(2)} to ${floorBounds.maximumWorld.z.toFixed(2)}`);
                }
            }
        }
        // Apply movement based on collision detection
        if (collisionDetected) {
            console.log(`🚧 ${paddle.name} blocked by ${hitWallName} - staying at Z: ${paddle.position.z.toFixed(2)}`);
            this.playBoundaryHitSound();
            // Don't move - collision detected
        }
        else {
            // Safe to move
            paddle.position.z = intendedNewPosition.z;
            console.log(`✅ ${paddle.name} moved safely to Z: ${intendedNewPosition.z.toFixed(2)}`);
        }
    }
    // Enhanced debugging method - visualize rays and boundaries
    debugVisualizeRays(rayPositions, rayDirection, rayDistance) {
        // Enable this for debugging
        const DEBUG_RAYS = true;
        if (!DEBUG_RAYS)
            return;
        rayPositions.forEach((start, index) => {
            const end = start.add(rayDirection.scale(rayDistance));
            // Create a thin line to visualize the ray
            const rayLine = MeshBuilder.CreateLines(`debugRay_${index}`, {
                points: [start, end]
            }, this.scene);
            rayLine.color = Color3.Red();
            // Remove after longer time to see them better
            setTimeout(() => {
                rayLine.dispose();
            }, 2000);
        });
        // Also visualize floor boundaries for debugging
        this.debugVisualizeFloorBounds();
    }
    debugVisualizeFloorBounds() {
        const floorPlane = this.scene.getMeshByName('floorPlane');
        if (!floorPlane)
            return;
        floorPlane.computeWorldMatrix(true);
        floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
        const floorBounds = floorPlane.getBoundingInfo().boundingBox;
        console.log(`🏢 Floor bounds - X: ${floorBounds.minimumWorld.x.toFixed(2)} to ${floorBounds.maximumWorld.x.toFixed(2)}`);
        console.log(`🏢 Floor bounds - Y: ${floorBounds.minimumWorld.y.toFixed(2)} to ${floorBounds.maximumWorld.y.toFixed(2)}`);
        console.log(`🏢 Floor bounds - Z: ${floorBounds.minimumWorld.z.toFixed(2)} to ${floorBounds.maximumWorld.z.toFixed(2)}`);
        // Create visual markers at floor corners for debugging
        const floorY = floorBounds.maximumWorld.y + 0.1; // Slightly above floor
        const cornerHeight = 0.5;
        // Front-left corner
        const frontLeft = MeshBuilder.CreateBox("debug_frontLeft", {
            width: 0.1, height: cornerHeight, depth: 0.1
        }, this.scene);
        frontLeft.position = new Vector3(floorBounds.minimumWorld.x, floorY + cornerHeight / 2, floorBounds.maximumWorld.z);
        frontLeft.material = new StandardMaterial("debugMat", this.scene);
        frontLeft.material.diffuseColor = Color3.Yellow();
        // Front-right corner  
        const frontRight = MeshBuilder.CreateBox("debug_frontRight", {
            width: 0.1, height: cornerHeight, depth: 0.1
        }, this.scene);
        frontRight.position = new Vector3(floorBounds.maximumWorld.x, floorY + cornerHeight / 2, floorBounds.maximumWorld.z);
        frontRight.material = frontLeft.material;
        // Back-left corner
        const backLeft = MeshBuilder.CreateBox("debug_backLeft", {
            width: 0.1, height: cornerHeight, depth: 0.1
        }, this.scene);
        backLeft.position = new Vector3(floorBounds.minimumWorld.x, floorY + cornerHeight / 2, floorBounds.minimumWorld.z);
        backLeft.material = frontLeft.material;
        // Back-right corner
        const backRight = MeshBuilder.CreateBox("debug_backRight", {
            width: 0.1, height: cornerHeight, depth: 0.1
        }, this.scene);
        backRight.position = new Vector3(floorBounds.maximumWorld.x, floorY + cornerHeight / 2, floorBounds.minimumWorld.z);
        backRight.material = frontLeft.material;
        // Remove debug markers after some time
        setTimeout(() => {
            frontLeft.dispose();
            frontRight.dispose();
            backLeft.dispose();
            backRight.dispose();
        }, 5000);
    }
    setupLighting() {
        this.setupStrongLightSystem();
    }
    setupStrongLightSystem() {
        // We'll create strong emissive lighting after the GLB is loaded
        console.log("💡 Preparing strong light emission system with shadows");
    }
    makePaddleEmitLight(parentMesh, lightColor, side) {
        // First, make the paddle itself emit light visually
        const emissiveMaterial = new PBRMaterial(`${parentMesh.name}_emissive`, this.scene);
        // Set base color to match the light emission for better color harmony
        if (side === 'left') {
            emissiveMaterial.albedoColor = new Color3(0.05, 0.15, 0.20); // Dark cyan-blue base
        }
        else {
            emissiveMaterial.albedoColor = new Color3(0.20, 0.08, 0.02); // Dark orange-red base
        }
        emissiveMaterial.emissiveColor = lightColor;
        emissiveMaterial.emissiveIntensity = 2.0; // Strong emissive glow
        emissiveMaterial.roughness = 0.1;
        emissiveMaterial.metallicF0Factor = 0.8;
        // Apply the emissive material to make paddle glow
        parentMesh.material = emissiveMaterial;
        // Create a very strong point light for dramatic shadows
        const lightOffset = new Vector3(0, 0.5, 0); // Position above paddle center
        const strongLight = new PointLight(`${parentMesh.name}_strongLight`, parentMesh.position.add(lightOffset), this.scene);
        // VERY strong intensity for dramatic effect
        strongLight.diffuse = lightColor;
        strongLight.specular = lightColor;
        strongLight.intensity = 15.0; // Very high intensity
        strongLight.range = 50.0; // Large range, we'll block it with invisible objects
        strongLight.falloffType = PointLight.FALLOFF_PHYSICAL; // Realistic falloff
        // Parent the light to the paddle
        strongLight.parent = parentMesh;
        strongLight.position.copyFrom(lightOffset);
        // Create shadow generator for dramatic shadows
        const shadowGenerator = new ShadowGenerator(1024, strongLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 4;
        shadowGenerator.bias = 0.0001;
        shadowGenerator.setDarkness(0.8); // Very dark shadows
        // Add all meshes as shadow casters
        this.scene.meshes.forEach(mesh => {
            if (mesh.name !== "skybox" && mesh !== parentMesh) {
                shadowGenerator.addShadowCaster(mesh);
            }
        });
        // Enable the floor to receive shadows
        const floorPlane = this.scene.getMeshByName('floorPlane');
        if (floorPlane) {
            floorPlane.receiveShadows = true;
        }
        // Create invisible light blocker
        this.createLightBlocker(parentMesh, side);
        console.log(`💡 Created strong light emission for ${parentMesh.name} (${side} side)`);
    }
    createLightBlocker(parentMesh, side) {
        // Create invisible planes that block light from traveling too far
        const blockerDistance = 6.0; // Distance from paddle where we block light
        // Create multiple blocker planes around the paddle
        const blockerPositions = [
            new Vector3(0, 0, blockerDistance), // Front blocker
            new Vector3(0, 0, -blockerDistance), // Back blocker
            new Vector3(side === 'left' ? blockerDistance : -blockerDistance, 0, 0), // Side blocker
        ];
        blockerPositions.forEach((offset, index) => {
            const blocker = MeshBuilder.CreatePlane(`${parentMesh.name}_lightBlocker_${index}`, {
                size: 15
            }, this.scene);
            // Position the blocker
            blocker.position = parentMesh.position.add(offset);
            // Make it invisible but still block light
            const blockerMaterial = new StandardMaterial(`${parentMesh.name}_blockerMaterial_${index}`, this.scene);
            blockerMaterial.alpha = 0.0; // Completely transparent
            blockerMaterial.disableLighting = true;
            blocker.material = blockerMaterial;
            // Make it non-interactive for gameplay
            blocker.isPickable = false;
            blocker.checkCollisions = false;
            // Parent to paddle so it moves with it
            blocker.parent = parentMesh;
            blocker.position.copyFrom(offset);
            // Orient the blocker correctly
            if (Math.abs(offset.z) > Math.abs(offset.x)) {
                // Front/back blocker - face the paddle
                blocker.rotation.y = offset.z > 0 ? 0 : Math.PI;
            }
            else {
                // Side blocker - face inward
                blocker.rotation.y = offset.x > 0 ? -Math.PI / 2 : Math.PI / 2;
            }
        });
        console.log(`🚧 Created light blockers for ${parentMesh.name}`);
    }
    createStrongLightingForGameObjects() {
        // Create strong light emission for paddles only
        const paddleLeft = this.scene.getMeshByName('paddleLeft');
        const paddleRight = this.scene.getMeshByName('paddleRight');
        if (paddleLeft) {
            // Left paddle gets bright cyan-blue emission
            this.makePaddleEmitLight(paddleLeft, new Color3(0.2, 0.8, 1.0), 'left');
        }
        if (paddleRight) {
            // Right paddle gets bright orange-red emission
            this.makePaddleEmitLight(paddleRight, new Color3(1.0, 0.4, 0.1), 'right');
        }
        console.log("💡 Strong light emission system created for paddles");
    }
    logAllObjectCoordinates() {
        console.log("📍 All Object Coordinates:");
        this.scene.meshes.forEach(mesh => {
            if (mesh.name !== "skybox" && !mesh.name.includes("_shadow")) {
                const pos = mesh.position;
                console.log(`  ${mesh.name}: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
            }
        });
    }
    setupCustomMaterials() {
        this.createBackgroundLayers();
    }
    createBackgroundLayers() {
        this.createSkybox();
    }
    createSkybox() {
        // Create a large cube that surrounds the entire scene - better for rectangular textures
        const skybox = MeshBuilder.CreateBox("skybox", { size: 1000 }, this.scene);
        // Create skybox material
        const skyboxMaterial = new StandardMaterial("skyboxMaterial", this.scene);
        skyboxMaterial.backFaceCulling = false; // Render inside faces
        // Use diffuse texture instead of reflection for proper UV mapping
        skyboxMaterial.diffuseTexture = new Texture("public/textures/starfield.png", this.scene);
        skyboxMaterial.diffuseTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
        skyboxMaterial.diffuseTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
        // Set emissive to make it glow without lighting
        skyboxMaterial.emissiveTexture = skyboxMaterial.diffuseTexture;
        skyboxMaterial.emissiveColor = new Color3(1.0, 1.0, 1.0); // White to preserve original colors
        skyboxMaterial.specularColor = new Color3(0, 0, 0); // No specular lighting
        skyboxMaterial.disableLighting = true; // Disable lighting calculations
        skybox.material = skyboxMaterial;
        skybox.infiniteDistance = true; // Always render at infinite distance
        // Make sure skybox moves with camera but ignores translation
        skybox.parent = this.scene.activeCamera;
        // Add rotation animation for moving stars effect
        this.scene.registerBeforeRender(() => {
            skybox.rotation.y += 0.001; // Increased rotation speed
        });
    }
    setupScene() {
        // Start render loop immediately so we can see the camera/lighting
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        // ✅ Append entire .glb scene to the current scene
        console.log("🔍 Attempting to load GLB from: /public/models/game.glb");
        SceneLoader.LoadAssetContainerAsync("/public/models/", "game.glb", this.scene).then((container) => {
            console.log("✅ GLB loaded successfully:", container);
            container.addAllToScene();
            console.log("📦 Added all meshes to scene");
            // Position objects at their proper coordinates
            this.positionObjectsAtCoordinates();
            // Create strong light emission effects for game objects
            this.createStrongLightingForGameObjects();
            // Create invisible walls at floor edges
            this.createInvisibleWalls();
            // Setup paddle controls after GLB is loaded
            this.setupPaddleControls();
            // Initialize ball physics system
            this.initializeBallSystem();
            // Lock camera to object coordinates
            // this.lockCameraToObjectCoordinates();
            // Debug materials to check lighting compatibility
            // this.debugObjectMaterials();
        }).catch((err) => {
            console.error("❌ Failed to load GLB scene:", err);
            console.log("🔍 Trying alternative path: ./public/models/game.glb");
            // Try alternative path
            SceneLoader.LoadAssetContainerAsync("./public/models/", "game.glb", this.scene).then((container) => {
                console.log("✅ GLB loaded with alternative path:", container);
                container.addAllToScene();
                console.log("📦 Added all meshes to scene");
                // Position objects at their proper coordinates
                this.positionObjectsAtCoordinates();
                // Create strong light emission effects for game objects
                this.createStrongLightingForGameObjects();
                // Create invisible walls at floor edges
                this.createInvisibleWalls();
                // Setup paddle controls after GLB is loaded
                this.setupPaddleControls();
                // Initialize ball physics system
                this.initializeBallSystem();
                // Lock camera to object coordinates
                // this.lockCameraToObjectCoordinates();
                // Debug materials to check lighting compatibility
                // this.debugObjectMaterials();
            }).catch((err2) => {
                console.error("❌ Alternative path also failed:", err2);
            });
        });
    }
    dispose() {
        // Dispose audio resources
        if (this.audioContext)
            this.audioContext.close();
        this.guiManager.dispose();
        this.scene.dispose();
        this.engine.dispose();
    }
    initializeBallSystem() {
        const ball = this.scene.getMeshByName('pongBall');
        if (!ball) {
            console.warn("⚠️ Ball not found in scene");
            return;
        }
        console.log("⚽ Initializing ball physics system");
        // Start ball movement
        this.scene.registerBeforeRender(() => {
            this.updateBallPhysics();
        });
    }
    updateBallPhysics() {
        // Skip ball updates if game is paused
        if (this.isPaused)
            return;
        const ball = this.scene.getMeshByName('pongBall');
        if (!ball)
            return;
        // Update ball position based on velocity
        ball.position.addInPlace(this.ballVelocity);
        // Check collisions and bounce
        this.checkBallCollisions(ball);
    }
    checkBallCollisions(ball) {
        // Get ball bounds for collision detection
        ball.computeWorldMatrix(true);
        ball.getBoundingInfo().update(ball.getWorldMatrix());
        const ballBounds = ball.getBoundingInfo().boundingBox;
        const ballRadius = (ballBounds.maximumWorld.x - ballBounds.minimumWorld.x) / 2;
        // Check collision with floor boundaries (Z-axis walls)
        const floorPlane = this.scene.getMeshByName('floorPlane');
        if (floorPlane) {
            floorPlane.computeWorldMatrix(true);
            floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
            const floorBounds = floorPlane.getBoundingInfo().boundingBox;
            // Ball hits front or back wall (Z boundaries)
            if (ball.position.z + ballRadius >= floorBounds.maximumWorld.z ||
                ball.position.z - ballRadius <= floorBounds.minimumWorld.z) {
                this.ballVelocity.z *= -1; // Reverse Z velocity
                this.playBallWallBounceSound();
                console.log("⚽ Ball bounced off Z wall");
            }
        }
        // Check collision with paddles (X boundaries and paddle collision)
        this.checkPaddleCollisions(ball, ballRadius);
    }
    checkPaddleCollisions(ball, ballRadius) {
        const leftPaddle = this.scene.getMeshByName('paddleLeft');
        const rightPaddle = this.scene.getMeshByName('paddleRight');
        // Check collision with left paddle
        if (leftPaddle && this.ballCollidesWithPaddle(ball, leftPaddle, ballRadius)) {
            this.ballVelocity.x = Math.abs(this.ballVelocity.x); // Ensure ball moves right
            this.addPaddleInfluence(ball, leftPaddle);
            this.playBallHitSound();
            console.log("⚽ Ball hit left paddle");
        }
        // Check collision with right paddle  
        if (rightPaddle && this.ballCollidesWithPaddle(ball, rightPaddle, ballRadius)) {
            this.ballVelocity.x = -Math.abs(this.ballVelocity.x); // Ensure ball moves left
            this.addPaddleInfluence(ball, rightPaddle);
            this.playBallHitSound();
            console.log("⚽ Ball hit right paddle");
        }
        // Check if ball went past paddles (scoring)
        if (ball.position.x < -25) {
            console.log("🎯 Right player scores!");
            this.playScoreSound();
            this.resetBall();
        }
        else if (ball.position.x > 25) {
            console.log("🎯 Left player scores!");
            this.playScoreSound();
            this.resetBall();
        }
    }
    ballCollidesWithPaddle(ball, paddle, ballRadius) {
        // Simple collision detection between ball and paddle
        const ballPos = ball.position;
        const paddlePos = paddle.position;
        // Get paddle dimensions
        paddle.computeWorldMatrix(true);
        paddle.getBoundingInfo().update(paddle.getWorldMatrix());
        const paddleBounds = paddle.getBoundingInfo().boundingBox;
        const paddleWidth = Math.abs(paddleBounds.maximumWorld.x - paddleBounds.minimumWorld.x);
        const paddleHeight = Math.abs(paddleBounds.maximumWorld.y - paddleBounds.minimumWorld.y);
        const paddleDepth = Math.abs(paddleBounds.maximumWorld.z - paddleBounds.minimumWorld.z);
        // Check if ball is within paddle bounds
        const withinX = Math.abs(ballPos.x - paddlePos.x) < (paddleWidth / 2 + ballRadius);
        const withinY = Math.abs(ballPos.y - paddlePos.y) < (paddleHeight / 2 + ballRadius);
        const withinZ = Math.abs(ballPos.z - paddlePos.z) < (paddleDepth / 2 + ballRadius);
        return withinX && withinY && withinZ;
    }
    addPaddleInfluence(ball, paddle) {
        // Add some randomness and paddle position influence to ball direction
        const relativeHitPosition = (ball.position.z - paddle.position.z) / 2; // Normalize hit position
        this.ballVelocity.z = relativeHitPosition * 0.3; // Add influence to Z direction
        // Slightly increase speed after each paddle hit
        this.ballVelocity.normalize();
        this.ballVelocity.scaleInPlace(this.ballSpeed * 1.05);
        this.ballSpeed = Math.min(this.ballSpeed * 1.02, 0.8); // Cap max speed
    }
    resetBall() {
        const ball = this.scene.getMeshByName('pongBall');
        if (!ball)
            return;
        // Reset ball to center
        ball.position = new Vector3(0.00, 0.78, 0.00);
        // Reset velocity with random direction
        const randomZ = (Math.random() - 0.5) * 0.4;
        const randomX = Math.random() > 0.5 ? 0.3 : -0.3;
        this.ballVelocity = new Vector3(randomX, 0, randomZ);
        this.ballSpeed = 0.4; // Reset speed
        console.log("⚽ Ball reset to center");
    }
}
// ✅ Entry point
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("renderCanvas");
    if (!canvas) {
        console.error("❌ Canvas element with id 'renderCanvas' not found.");
        return;
    }
    new GLBScene(canvas);
});
//# sourceMappingURL=main.js.map