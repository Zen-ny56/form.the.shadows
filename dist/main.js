// ===========================================
//          HEADERS                           
// ===========================================
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
import { GUIManager } from "./gui-manager.js";
import "@babylonjs/loaders/glTF"; // Required for loading .glb/.gltf
// ===========================================
// *******************************************
// ===========================================
// =====================================
// MAIN GAME MANAGER - Orchestrator
// =====================================
class PongGameManager {
    constructor(canvas) {
        this.isRunning = false;
        this.lastTime = 0;
        // Initialize all systems
        this.renderEngine = new RenderEngine(canvas); // 🎨 The "visual display" chef
        this.inputManager = new InputManager(); // 🎮 The "order taker" (keyboard/mouse)
        this.physicsSystem = new PhysicsSystem(); // ⚡ The "movement & collision" chef
        this.audioManager = new AudioManager(); // 🔊 The "sound effects" DJ
        this.uiManager = new UIManager(); // 🖥️ The "menu display" manager
        this.scoreManager = new ScoreManager(); // 🥅 The "score keeper" manager
        // Initialize game state manager with references to all systems
        this.gameState = new GameStateManager({
            renderEngine: this.renderEngine,
            inputManager: this.inputManager,
            physicsSystem: this.physicsSystem,
            audioManager: this.audioManager,
            uiManager: this.uiManager,
            scoreManager: this.scoreManager
        });
        this.initialize();
    }
    async initialize() {
        console.log("🎮 Initializing Pong Game Manager...");
        // Initialize all systems in order
        await this.renderEngine.initialize();
        this.inputManager.initialize();
        this.physicsSystem.initialize();
        this.audioManager.initialize();
        this.uiManager.initialize();
        this.scoreManager.initialize();
        // Hook score change to UI flash
        this.scoreManager.setScoreChangeCallback(({ leftScore, rightScore, scorer }) => {
            this.uiManager.showScoreFlash({ scorer, leftScore, rightScore });
        });
        // Start with menu state
        this.gameState.setState('menu');
        this.startGameLoop();
        console.log("✅ Game Manager initialized successfully!");
    }
    startGameLoop() {
        this.isRunning = true;
        const gameLoop = (timestamp) => {
            if (!this.isRunning)
                return;
            const deltaTime = timestamp - this.lastTime; // 
            this.lastTime = timestamp;
            // Update all systems
            this.gameState.update(deltaTime);
            this.physicsSystem.update(deltaTime);
            this.renderEngine.update(deltaTime);
            this.uiManager.update(deltaTime);
            // Render
            this.renderEngine.render();
            this.uiManager.render();
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    }
    dispose() {
        this.isRunning = false;
        this.renderEngine.dispose();
        this.inputManager.dispose();
        this.physicsSystem.dispose();
        this.audioManager.dispose();
        this.uiManager.dispose();
    }
}
// =====================================
// RENDER ENGINE - 3D Babylon.js Layer
// =====================================
class RenderEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gameObjects = new Map();
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
    }
    async initialize() {
        console.log("🎨 Initializing Render Engine...");
        this.setupCamera();
        this.setupLighting();
        this.setupCustomMaterials();
        this.setupResizeListener();
        this.setupAudio();
        await this.loadAssets();
        // Start render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        console.log("✅ Render Engine initialized!");
    }
    setupCamera() {
        // Create ArcRotateCamera with desired position
        this.camera = new ArcRotateCamera("camera", -1.569, 0.593, 43.461, Vector3.Zero(), this.scene);
        // Lock the camera - disable all controls
        this.camera.attachControl(this.canvas, false);
        this.camera.inputs.clear();
        this.scene.activeCamera = this.camera;
        console.log("📷 Camera locked at desired position");
    }
    setupLighting() {
        this.setupStrongLightSystem();
    }
    setupCustomMaterials() {
        this.createBackgroundLayers();
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
    async loadAssets() {
        console.log("📦 Loading game assets...");
        try {
            const container = await SceneLoader.LoadAssetContainerAsync("/public/models/", "game.glb", this.scene);
            container.addAllToScene();
            console.log("📦 Assets loaded successfully");
            this.initializeGameObjects();
            this.positionObjects();
            this.createStrongLightingForGameObjects();
            this.createInvisibleWalls();
            this.setupPaddleControls();
            this.initializeBallSystem();
            this.setupInteractiveCoordinateDisplay();
        }
        catch (error) {
            console.log("🔍 Trying alternative path...");
            try {
                const container = await SceneLoader.LoadAssetContainerAsync("./public/models/", "game.glb", this.scene);
                container.addAllToScene();
                console.log("📦 Assets loaded with alternative path");
                this.initializeGameObjects();
                this.positionObjects();
                this.createStrongLightingForGameObjects();
                this.createInvisibleWalls();
                this.setupPaddleControls();
                this.initializeBallSystem();
                this.setupInteractiveCoordinateDisplay();
            }
            catch (err2) {
                console.error("❌ Failed to load assets:", err2);
            }
        }
    }
    initializeGameObjects() {
        const leftPaddleMesh = this.scene.getMeshByName('paddleLeft');
        const rightPaddleMesh = this.scene.getMeshByName('paddleRight');
        const ballMesh = this.scene.getMeshByName('pongBall');
        if (leftPaddleMesh) {
            this.gameObjects.set('leftPaddle', new GameObject3D(leftPaddleMesh, 'paddle'));
        }
        if (rightPaddleMesh) {
            this.gameObjects.set('rightPaddle', new GameObject3D(rightPaddleMesh, 'paddle'));
        }
        if (ballMesh) {
            this.gameObjects.set('ball', new GameObject3D(ballMesh, 'ball'));
        }
        console.log(`🎯 Initialized ${this.gameObjects.size} game objects`);
    }
    positionObjects() {
        const objectPositions = {
            'paddleLeft': new Vector3(-20.28, 1.00, 0.00),
            'pongBall': new Vector3(0.00, 0.78, 0.00),
            'centreLine': new Vector3(0.00, 0.05, 0.00),
            'paddleRight': new Vector3(20.28, 1.00, 0.00),
            'floorPlane': new Vector3(0.00, 0.00, 0.00)
        };
        Object.keys(objectPositions).forEach(meshName => {
            const mesh = this.scene.getMeshByName(meshName);
            if (mesh) {
                const pos = objectPositions[meshName];
                mesh.position.copyFrom(pos);
                console.log(`📍 Positioned ${meshName} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
            }
        });
    }
    createStrongLightingForGameObjects() {
        const paddleLeft = this.scene.getMeshByName('paddleLeft');
        const paddleRight = this.scene.getMeshByName('paddleRight');
        if (paddleLeft) {
            this.makePaddleEmitLight(paddleLeft, new Color3(0.2, 0.8, 1.0), 'left');
        }
        if (paddleRight) {
            this.makePaddleEmitLight(paddleRight, new Color3(1.0, 0.4, 0.1), 'right');
        }
        console.log("💡 Strong light emission system created for paddles");
    }
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
    setupStrongLightSystem() {
        // We'll create strong emissive lighting after the GLB is loaded
        console.log("💡 Preparing strong light emission system with shadows");
    }
    makePaddleEmitLight(parentMesh, lightColor, side) {
        const emissiveMaterial = new PBRMaterial(`${parentMesh.name}_emissive`, this.scene);
        if (side === 'left') {
            emissiveMaterial.albedoColor = new Color3(0.05, 0.15, 0.20);
        }
        else {
            emissiveMaterial.albedoColor = new Color3(0.20, 0.08, 0.02);
        }
        emissiveMaterial.emissiveColor = lightColor;
        emissiveMaterial.emissiveIntensity = 2.0;
        emissiveMaterial.roughness = 0.1;
        emissiveMaterial.metallicF0Factor = 0.8;
        parentMesh.material = emissiveMaterial;
        const lightOffset = new Vector3(0, 0.5, 0);
        const strongLight = new PointLight(`${parentMesh.name}_strongLight`, parentMesh.position.add(lightOffset), this.scene);
        strongLight.diffuse = lightColor;
        strongLight.specular = lightColor;
        strongLight.intensity = 15.0;
        strongLight.range = 50.0;
        strongLight.falloffType = PointLight.FALLOFF_PHYSICAL;
        strongLight.parent = parentMesh;
        strongLight.position.copyFrom(lightOffset);
        const shadowGenerator = new ShadowGenerator(1024, strongLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 4;
        shadowGenerator.bias = 0.0001;
        shadowGenerator.setDarkness(0.8);
        this.scene.meshes.forEach(mesh => {
            if (mesh.name !== "skybox" && mesh !== parentMesh) {
                shadowGenerator.addShadowCaster(mesh);
            }
        });
        const floorPlane = this.scene.getMeshByName('floorPlane');
        if (floorPlane) {
            floorPlane.receiveShadows = true;
        }
        this.createLightBlocker(parentMesh, side);
    }
    createLightBlocker(parentMesh, side) {
        const blockerDistance = 6.0;
        const blockerPositions = [
            new Vector3(0, 0, blockerDistance),
            new Vector3(0, 0, -blockerDistance),
            new Vector3(side === 'left' ? blockerDistance : -blockerDistance, 0, 0),
        ];
        blockerPositions.forEach((offset, index) => {
            const blocker = MeshBuilder.CreatePlane(`${parentMesh.name}_lightBlocker_${index}`, {
                size: 15
            }, this.scene);
            blocker.position = parentMesh.position.add(offset);
            const blockerMaterial = new StandardMaterial(`${parentMesh.name}_blockerMaterial_${index}`, this.scene);
            blockerMaterial.alpha = 0.0;
            blockerMaterial.disableLighting = true;
            blocker.material = blockerMaterial;
            blocker.isPickable = false;
            blocker.checkCollisions = false;
            blocker.parent = parentMesh;
            blocker.position.copyFrom(offset);
            if (Math.abs(offset.z) > Math.abs(offset.x)) {
                blocker.rotation.y = offset.z > 0 ? 0 : Math.PI;
            }
            else {
                blocker.rotation.y = offset.x > 0 ? -Math.PI / 2 : Math.PI / 2;
            }
        });
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
    initializeBallSystem() {
        const ball = this.scene.getMeshByName('pongBall');
        if (!ball) {
            console.warn("⚠️ Ball not found in scene");
            return;
        }
    }
    dispose() {
        // Dispose audio resources
        if (this.audioContext)
            this.audioContext.close();
        this.guiManager.dispose();
        this.scene.dispose();
        this.engine.dispose();
    }
    setupResizeListener() {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }
    getGameObject(name) {
        return this.gameObjects.get(name);
    }
    getMesh(name) {
        return this.scene.getMeshByName(name);
    }
    getScene() {
        return this.scene;
    }
    update(deltaTime) {
        this.gameObjects.forEach(obj => obj.update(deltaTime));
    }
    render() {
        // Rendering is handled by the engine's render loop
    }
}
// =====================================
// GAME OBJECT 3D WRAPPER
// =====================================
class GameObject3D {
    constructor(mesh, type) {
        this.mesh = mesh;
        this.type = type;
    }
    get position() {
        return this.mesh.position;
    }
    set position(pos) {
        this.mesh.position.copyFrom(pos);
    }
    getBounds() {
        this.mesh.computeWorldMatrix(true);
        this.mesh.getBoundingInfo().update(this.mesh.getWorldMatrix());
        return this.mesh.getBoundingInfo().boundingBox;
    }
    update(deltaTime) {
        // Any per-frame updates for this object
    }
}
// =====================================
// PHYSICS SYSTEM
// =====================================
class PhysicsSystem {
    constructor() {
        this.ballVelocity = new Vector3(0.3, 0, 0.2);
        this.ballSpeed = 18; // units per second
        this.ballActive = false;
        this.renderEngine = null;
        this.scoreManager = null;
        this.hasScored = false;
    }
    initialize() {
        console.log("⚡ Physics system initialized");
    }
    setScoreManager(scoreManager) {
        this.scoreManager = scoreManager;
    }
    checkHasScored() {
        return this.hasScored;
    }
    resetScoredFlag() {
        this.hasScored = false;
    }
    resetPaddlePositions() {
        if (!this.renderEngine)
            return;
        const leftPaddle = this.renderEngine.getMesh('paddleLeft');
        const rightPaddle = this.renderEngine.getMesh('paddleRight');
        if (leftPaddle) {
            leftPaddle.position = new Vector3(-20.28, 1.00, 0.00);
            console.log("🏓 Left paddle reset to starting position");
        }
        if (rightPaddle) {
            rightPaddle.position = new Vector3(20.28, 1.00, 0.00);
            console.log("🏓 Right paddle reset to starting position");
        }
    }
    setRenderEngine(renderEngine) {
        this.renderEngine = renderEngine;
    }
    startBall() {
        if (!this.renderEngine)
            return;
        this.resetBallPosition();
        this.startBallMovement();
        this.ballActive = true;
        console.log("🏐 Ball movement started");
    }
    resumeBall() {
        if (!this.renderEngine)
            return;
        // Resume ball without resetting position
        this.ballActive = true;
        console.log("🏐 Ball movement resumed");
    }
    stopBall() {
        this.ballActive = false;
        console.log("🏐 Ball movement stopped");
    }
    resetBallPosition() {
        if (!this.renderEngine)
            return;
        const ball = this.renderEngine.getMesh('pongBall');
        if (ball) {
            ball.position = new Vector3(0.00, 0.78, 0.00);
        }
    }
    startBallMovement() {
        // Random initial direction, normalized and scaled to speed (units/sec)
        const randomZ = (Math.random() - 0.5) * 0.8;
        const randomX = Math.random() > 0.5 ? 1 : -1;
        const dir = new Vector3(randomX, 0, randomZ).normalize();
        this.ballSpeed = 18;
        this.ballVelocity = dir.scale(this.ballSpeed);
        console.log(`🏐 Ball velocity set to: (${this.ballVelocity.x.toFixed(2)}, ${this.ballVelocity.y.toFixed(2)}, ${this.ballVelocity.z.toFixed(2)}) (u/s)`);
    }
    updatePaddlePosition(paddleName, inputDirection, deltaTime) {
        if (!this.renderEngine || inputDirection === 0)
            return;
        const paddle = this.renderEngine.getMesh(paddleName);
        if (!paddle)
            return;
        const moveSpeedPerSec = 12; // units/sec
        const dz = inputDirection * moveSpeedPerSec * (Math.max(0, deltaTime) / 1000);
        const intendedNewPosition = paddle.position.add(new Vector3(0, 0, dz));
        // Collision detection logic (simplified from your original)
        if (this.canPaddleMoveTo(paddle, intendedNewPosition)) {
            paddle.position.z = intendedNewPosition.z;
        }
    }
    canPaddleMoveTo(paddle, newPosition) {
        if (!this.renderEngine)
            return false;
        const floorPlane = this.renderEngine.getMesh('floorPlane');
        if (!floorPlane)
            return true;
        floorPlane.computeWorldMatrix(true);
        floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
        const floorBounds = floorPlane.getBoundingInfo().boundingBox;
        paddle.computeWorldMatrix(true);
        paddle.getBoundingInfo().update(paddle.getWorldMatrix());
        const paddleBounds = paddle.getBoundingInfo().boundingBox;
        const paddleDepth = Math.abs(paddleBounds.maximumWorld.z - paddleBounds.minimumWorld.z);
        const frontEdge = newPosition.z + (paddleDepth / 2);
        const backEdge = newPosition.z - (paddleDepth / 2);
        return frontEdge <= floorBounds.maximumWorld.z &&
            backEdge >= floorBounds.minimumWorld.z;
    }
    update(deltaTime) {
        if (!this.ballActive || !this.renderEngine)
            return;
        this.updateBallPosition(deltaTime);
    }
    updateBallPosition(deltaTime) {
        if (!this.renderEngine)
            return;
        const ball = this.renderEngine.getMesh('pongBall');
        if (!ball)
            return;
        // Move ball using frame-rate independent integration
        const dt = Math.max(0, deltaTime) / 1000; // seconds
        if (dt > 0) {
            const displacement = this.ballVelocity.scale(dt);
            ball.position.addInPlace(displacement);
        }
        // Check collisions
        this.checkBallCollisions(ball);
    }
    checkBallCollisions(ball) {
        this.checkWallCollisions(ball);
        this.checkPaddleCollisions(ball);
    }
    checkWallCollisions(ball) {
        if (!this.renderEngine)
            return;
        const floorPlane = this.renderEngine.getMesh('floorPlane');
        if (!floorPlane)
            return;
        floorPlane.computeWorldMatrix(true);
        floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
        const floorBounds = floorPlane.getBoundingInfo().boundingBox;
        const ballRadius = 0.39;
        if (ball.position.z + ballRadius >= floorBounds.maximumWorld.z) {
            this.ballVelocity.z = -Math.abs(this.ballVelocity.z);
            ball.position.z = floorBounds.maximumWorld.z - ballRadius;
            if (this.renderEngine && this.renderEngine.playBallWallBounceSound) {
                this.renderEngine.playBallWallBounceSound();
            }
        }
        if (ball.position.z - ballRadius <= floorBounds.minimumWorld.z) {
            this.ballVelocity.z = Math.abs(this.ballVelocity.z);
            ball.position.z = floorBounds.minimumWorld.z + ballRadius;
            if (this.renderEngine && this.renderEngine.playBallWallBounceSound) {
                this.renderEngine.playBallWallBounceSound();
            }
        }
    }
    checkPaddleCollisions(ball) {
        if (!this.renderEngine)
            return;
        const leftPaddle = this.renderEngine.getMesh('paddleLeft');
        const rightPaddle = this.renderEngine.getMesh('paddleRight');
        const ballRadius = 0.39;
        // Check collision with left paddle
        if (leftPaddle && this.ballCollidesWithPaddle(ball, leftPaddle, ballRadius)) {
            this.ballVelocity.x = Math.abs(this.ballVelocity.x); // Ensure ball moves right
            this.addPaddleInfluence(ball, leftPaddle);
            if (this.renderEngine && this.renderEngine.playBallHitSound) {
                this.renderEngine.playBallHitSound();
            }
            console.log("🏐 Ball hit left paddle");
        }
        // Check collision with right paddle  
        if (rightPaddle && this.ballCollidesWithPaddle(ball, rightPaddle, ballRadius)) {
            this.ballVelocity.x = -Math.abs(this.ballVelocity.x); // Ensure ball moves left
            this.addPaddleInfluence(ball, rightPaddle);
            if (this.renderEngine && this.renderEngine.playBallHitSound) {
                this.renderEngine.playBallHitSound();
            }
            console.log("🏐 Ball hit right paddle");
        }
        // Check if ball went past paddles (scoring)
        if (ball.position.x < -25) {
            if (this.scoreManager) {
                this.scoreManager.scorePoint('right');
            }
            if (this.renderEngine && this.renderEngine.playScoreSound) {
                this.renderEngine.playScoreSound();
            }
            this.hasScored = true;
            this.resetBall();
        }
        else if (ball.position.x > 25) {
            if (this.scoreManager) {
                this.scoreManager.scorePoint('left');
            }
            if (this.renderEngine && this.renderEngine.playScoreSound) {
                this.renderEngine.playScoreSound();
            }
            this.hasScored = true;
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
        this.ballVelocity.z += relativeHitPosition * this.ballSpeed * 0.2; // Add influence to Z direction
        // Slightly increase speed after each paddle hit (cap to a reasonable max)
        this.ballSpeed = Math.min(this.ballSpeed * 1.05, 36.0);
        // Normalize and rescale to maintain proper speed
        this.ballVelocity.normalize();
        this.ballVelocity.scaleInPlace(this.ballSpeed);
        console.log(`🏐 Ball speed increased to: ${this.ballSpeed.toFixed(2)}`);
    }
    resetBall() {
        if (!this.renderEngine)
            return;
        const ball = this.renderEngine.getMesh('pongBall');
        if (!ball)
            return;
        // Reset ball to center
        ball.position = new Vector3(0.00, 0.78, 0.00);
        // Stop the ball movement temporarily
        this.ballActive = false;
        this.ballVelocity = new Vector3(0, 0, 0);
        // If someone scored, reset paddles and immediately restart ball (no UI countdown between rounds)
        if (this.hasScored) {
            this.resetPaddlePositions();
            this.resetScoredFlag();
            this.resetBallMovement();
        }
        else {
            this.resetBallMovement();
        }
    }
    resetBallMovement() {
        // Reset with random direction and base speed (units/sec)
        const randomZ = (Math.random() - 0.5) * 0.8;
        const randomX = Math.random() > 0.5 ? 1 : -1;
        const dir = new Vector3(randomX, 0, randomZ).normalize();
        this.ballSpeed = 18;
        this.ballVelocity = dir.scale(this.ballSpeed);
        this.ballActive = true;
        console.log("🏐 Ball reset to center with velocity:", this.ballVelocity);
    }
    // Removed post-score countdown; handled immediately for quicker gameplay
    dispose() {
        this.ballActive = false;
    }
}
// =====================================
// INPUT MANAGER
// =====================================
class InputManager {
    constructor() {
        this.keyStates = new Map();
        this.inputHandlers = new Map();
    }
    initialize() {
        this.setupEventListeners();
        console.log("🎮 Input manager initialized");
    }
    setupEventListeners() {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (!this.keyStates.get(key)) {
                this.keyStates.set(key, true);
                const handler = this.inputHandlers.get(key);
                if (handler)
                    handler(true);
            }
        });
        window.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            this.keyStates.set(key, false);
            const handler = this.inputHandlers.get(key);
            if (handler)
                handler(false);
        });
    }
    isKeyPressed(key) {
        return this.keyStates.get(key.toLowerCase()) || false;
    }
    registerHandler(key, handler) {
        this.inputHandlers.set(key.toLowerCase(), handler);
    }
    unregisterHandler(key) {
        this.inputHandlers.delete(key.toLowerCase());
    }
    dispose() {
        this.inputHandlers.clear();
        this.keyStates.clear();
    }
}
// =====================================
// SCORE MANAGER
// =====================================
class ScoreManager {
    constructor() {
        this.leftScore = 0;
        this.rightScore = 0;
    }
    initialize() {
        console.log("📊 Score manager initialized");
    }
    setScoreChangeCallback(callback) {
        this.onScoreChange = callback;
    }
    scorePoint(side) {
        if (side === 'left') {
            this.leftScore++;
        }
        else {
            this.rightScore++;
        }
        console.log(`🎯 ${side} player scores! Score: ${this.leftScore} - ${this.rightScore}`);
        if (this.onScoreChange) {
            this.onScoreChange({ leftScore: this.leftScore, rightScore: this.rightScore, scorer: side });
        }
    }
    getScore() {
        return { left: this.leftScore, right: this.rightScore };
    }
    reset() {
        this.leftScore = 0;
        this.rightScore = 0;
        if (this.onScoreChange) {
            this.onScoreChange({ leftScore: this.leftScore, rightScore: this.rightScore, scorer: 'left' });
        }
    }
}
class GameStateManager {
    constructor(systems) {
        this.currentState = null;
        this.states = new Map();
        this.systems = systems;
        this.initializeStates();
    }
    initializeStates() {
        this.states.set('menu', new MenuState(this.systems, this));
        this.states.set('loading', new LoadingState(this.systems, this));
        this.states.set('playing', new PlayingState(this.systems, this));
        this.states.set('paused', new PausedState(this.systems, this));
        this.states.set('gameOver', new GameOverState(this.systems, this));
    }
    async setState(stateName) {
        if (this.currentState) {
            this.currentState.exit();
        }
        const newState = this.states.get(stateName);
        if (newState) {
            this.currentState = newState;
            await this.currentState.enter();
            console.log(`🎮 State changed to: ${stateName}`);
        }
    }
    update(deltaTime) {
        if (this.currentState) {
            this.currentState.update(deltaTime);
        }
    }
    getState(stateName) {
        return this.states.get(stateName);
    }
}
// =====================================
// GAME STATES
//
// Abstract classes
// =====================================
class GameState {
    constructor(systems, stateManager) {
        this.systems = systems;
        this.stateManager = stateManager;
    }
}
class MenuState extends GameState {
    enter() {
        console.log("📋 Entered Menu State");
        this.systems.uiManager.showStart();
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                this.systems.uiManager.hideStart();
                this.stateManager.setState('playing');
            }
        });
    }
    exit() {
        this.systems.uiManager.hideStart();
        this.systems.inputManager.unregisterHandler(' ');
    }
    update(deltaTime) { }
}
class LoadingState extends GameState {
    enter() {
        console.log("⏳ Entered Loading State");
        // Simulate loading, then transition to countdown
        setTimeout(() => {
            this.stateManager.setState('countdown');
        }, 1000);
    }
    exit() { }
    update(deltaTime) { }
}
class PlayingState extends GameState {
    constructor() {
        super(...arguments);
        this.isResumingFromPause = false;
        this.countdownState = {
            active: false,
            currentCount: 3,
            type: null,
            timer: null,
            resolve: null
        };
    }
    setResumingFromPause(resuming) {
        this.isResumingFromPause = resuming;
    }
    async enter() {
        console.log("🎮 Entered Playing State");
        // Set up physics system
        this.systems.physicsSystem.setRenderEngine(this.systems.renderEngine);
        this.systems.physicsSystem.setScoreManager(this.systems.scoreManager);
        if (this.isResumingFromPause) {
            console.log("🎮 Resuming from pause");
            // Check if there was a countdown in progress
            if (this.countdownState.active) {
                console.log("🎮 Resuming interrupted countdown");
                this.resumeCountdown();
                // Wait for countdown to finish before starting/resuming ball
                await new Promise((resolve) => {
                    const originalResolve = this.countdownState.resolve;
                    this.countdownState.resolve = () => {
                        if (originalResolve)
                            originalResolve();
                        resolve();
                    };
                });
                this.systems.physicsSystem.startBall();
            }
            else {
                console.log("🎮 No countdown to resume - resuming ball");
                this.systems.physicsSystem.resumeBall();
            }
        }
        else {
            console.log("🎮 Starting fresh game - doing countdown");
            await this.countdown('game-start');
            this.systems.physicsSystem.startBall();
        }
        this.setupInputHandlers();
        this.isResumingFromPause = false; // Reset flag after use
    }
    exit() {
        this.pauseCountdown();
        this.cleanupInputHandlers();
        this.systems.physicsSystem.stopBall();
    }
    update(deltaTime) {
        this.updatePaddleMovement(deltaTime);
    }
    countdown(type) {
        return new Promise((resolve) => {
            // If resuming an existing countdown, continue from where we left off
            const startingCount = this.countdownState.active ? this.countdownState.currentCount : 3;
            this.countdownState.active = true;
            this.countdownState.type = 'game-start';
            this.countdownState.currentCount = startingCount;
            this.countdownState.resolve = resolve;
            const isPostScore = false; // no post-score countdown now
            const tick = () => {
                if (!this.countdownState.active) {
                    // Countdown was paused, don't continue
                    return;
                }
                if (isPostScore) {
                    console.log(`⏱️ ${this.countdownState.currentCount}...`);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                }
                else {
                    console.log(this.countdownState.currentCount);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                }
                if (this.countdownState.currentCount <= 0) {
                    this.finishCountdown();
                }
                else {
                    this.countdownState.currentCount--;
                    this.countdownState.timer = setTimeout(tick, 1000);
                }
            };
            tick();
        });
    }
    finishCountdown() {
        if (this.countdownState.timer) {
            clearTimeout(this.countdownState.timer);
        }
        console.log("Countdown finished!");
        if (this.countdownState.resolve) {
            this.countdownState.resolve();
        }
        this.resetCountdownState();
        this.systems.uiManager.clearCountdown();
    }
    pauseCountdown() {
        if (this.countdownState.active && this.countdownState.timer) {
            clearTimeout(this.countdownState.timer);
            this.countdownState.timer = null;
            console.log(`⏸️ Countdown paused at ${this.countdownState.currentCount}`);
        }
    }
    resumeCountdown() {
        if (this.countdownState.active && !this.countdownState.timer && this.countdownState.resolve) {
            // Reset countdown to 3 when resuming after pause
            this.countdownState.currentCount = 3;
            console.log(`▶️ Restarting countdown from 3`);
            const isPostScore = false;
            const tick = () => {
                if (!this.countdownState.active) {
                    return;
                }
                if (isPostScore) {
                    console.log(`⏱️ ${this.countdownState.currentCount}...`);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                }
                else {
                    console.log(this.countdownState.currentCount);
                    this.systems.uiManager.showCountdown(this.countdownState.currentCount);
                }
                if (this.countdownState.currentCount <= 0) {
                    this.finishCountdown();
                }
                else {
                    this.countdownState.currentCount--;
                    this.countdownState.timer = setTimeout(tick, 1000);
                }
            };
            tick();
        }
    }
    resetCountdownState() {
        this.countdownState.active = false;
        this.countdownState.currentCount = 3;
        this.countdownState.type = null;
        this.countdownState.timer = null;
        this.countdownState.resolve = null;
    }
    setupInputHandlers() {
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                this.stateManager.setState('paused');
            }
        });
    }
    updatePaddleMovement(deltaTime) {
        // Left paddle movement
        let leftInput = 0;
        if (this.systems.inputManager.isKeyPressed('arrowleft'))
            leftInput -= 1;
        if (this.systems.inputManager.isKeyPressed('arrowright'))
            leftInput += 1;
        if (leftInput !== 0) {
            this.systems.physicsSystem.updatePaddlePosition('paddleLeft', leftInput, deltaTime);
        }
        // Right paddle movement
        let rightInput = 0;
        if (this.systems.inputManager.isKeyPressed('a'))
            rightInput -= 1;
        if (this.systems.inputManager.isKeyPressed('d'))
            rightInput += 1;
        if (rightInput !== 0) {
            this.systems.physicsSystem.updatePaddlePosition('paddleRight', rightInput, deltaTime);
        }
    }
    cleanupInputHandlers() {
        this.systems.inputManager.unregisterHandler(' ');
    }
}
class PausedState extends GameState {
    enter() {
        console.log("⏸️ Entered Paused State");
        this.systems.uiManager.showPause({
            onResume: () => {
                const playingState = this.stateManager.getState('playing');
                if (playingState)
                    playingState.setResumingFromPause(true);
                this.stateManager.setState('playing');
            },
            onRestart: () => {
                this.systems.scoreManager.reset();
                this.systems.physicsSystem.stopBall();
                this.systems.uiManager.hidePause();
                const playingState = this.stateManager.getState('playing');
                if (playingState)
                    playingState.setResumingFromPause(false);
                this.stateManager.setState('playing');
            }
        });
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                const playingState = this.stateManager.getState('playing');
                if (playingState)
                    playingState.setResumingFromPause(true);
                this.stateManager.setState('playing');
            }
        });
    }
    exit() {
        this.systems.uiManager.hidePause();
        this.systems.inputManager.unregisterHandler(' ');
    }
    update(deltaTime) { }
}
class GameOverState extends GameState {
    enter() {
        console.log("🏁 Entered Game Over State");
        this.systems.inputManager.registerHandler('r', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                const playingState = this.stateManager.getState('playing');
                if (playingState)
                    playingState.setResumingFromPause(false);
                this.stateManager.setState('playing');
            }
        });
    }
    exit() {
        this.systems.inputManager.unregisterHandler('r');
    }
    update(deltaTime) { }
}
// =====================================
// SUPPORTING SYSTEMS
// =====================================
class AudioManager {
    initialize() {
        console.log("🔊 Audio manager initialized");
    }
    play(soundName) {
        console.log(`🔊 Playing sound: ${soundName}`);
    }
    dispose() { }
}
class UIManager {
    constructor() {
        this.gui = new GUIManager();
    }
    initialize() {
        console.log("🖥️ UI manager initialized");
    }
    // Start Menu
    showStart(options) { this.gui.createStartMenu(options); }
    hideStart() { this.gui.removeStartMenu(); }
    // Pause Menu
    showPause(options) { this.gui.createPauseMenu(options); }
    hidePause() { this.gui.removePauseMenu(); }
    // Countdown
    showCountdown(value) { this.gui.updateCountdown(value); }
    clearCountdown() { this.gui.clearCountdown(); }
    // Score flash
    showScoreFlash(params) {
        this.gui.showScoreFlash(params);
    }
    clearScoreFlash() { this.gui.clearScoreFlash(); }
    update(deltaTime) { }
    render() { }
    dispose() { this.gui.dispose(); }
}
// =====================================
// INITIALIZATION
// =====================================
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("renderCanvas");
    if (!canvas) {
        console.error("❌ Canvas element with id 'renderCanvas' not found.");
        return;
    }
    console.log("🚀 Starting Pong Game...");
    new PongGameManager(canvas);
});
//# sourceMappingURL=main.js.map