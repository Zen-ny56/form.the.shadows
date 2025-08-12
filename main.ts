// ===========================================
//          HEADERS                           
// ===========================================

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Ray } from "@babylonjs/core/Culling/ray";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { BoundingBox } from "@babylonjs/core/Culling/boundingBox";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { ExecuteCodeAction } from "@babylonjs/core/Actions/directActions";
import "@babylonjs/loaders/glTF"; // Required for loading .glb/.gltf

// ===========================================
// *******************************************
// ===========================================

// =====================================
// MAIN GAME MANAGER - Orchestrator
// =====================================
class PongGameManager {
    private gameState: GameStateManager;
    private renderEngine: RenderEngine;
    private inputManager: InputManager;
    private physicsSystem: PhysicsSystem;
    private audioManager: AudioManager;
    private uiManager: UIManager;
    private scoreManager: ScoreManager;

    private isRunning: boolean = false;
    private lastTime: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        // Initialize all systems
        this.renderEngine = new RenderEngine(canvas); // 🎨 The "visual display" chef
        this.inputManager = new InputManager();       // 🎮 The "order taker" (keyboard/mouse)
        this.physicsSystem = new PhysicsSystem();    // ⚡ The "movement & collision" chef
        this.audioManager = new AudioManager();      // 🔊 The "sound effects" DJ
        this.uiManager = new UIManager();           // 🖥️ The "menu display" manager
        this.scoreManager = new ScoreManager();     // 🥅 The "score keeper" manager

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

    private async initialize(): Promise<void> {
        console.log("🎮 Initializing Pong Game Manager...");
        
        // Initialize all systems in order
        await this.renderEngine.initialize();
        this.inputManager.initialize();
        this.physicsSystem.initialize();
        this.audioManager.initialize();
        this.uiManager.initialize();
        this.scoreManager.initialize();

        // Start with menu state
        this.gameState.setState('menu');
        this.startGameLoop();
        
        console.log("✅ Game Manager initialized successfully!");
    }

    private startGameLoop(): void {
        this.isRunning = true;
        
        const gameLoop = (timestamp: number) => {
            if (!this.isRunning) return;
            
            const deltaTime = timestamp - this.lastTime;
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

    public dispose(): void {
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
    private engine: Engine;
    private scene: Scene;
    private camera!: ArcRotateCamera;
    private gameObjects: Map<string, GameObject3D> = new Map();

    constructor(private canvas: HTMLCanvasElement) {
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
    }

    async initialize(): Promise<void> {
        console.log("🎨 Initializing Render Engine...");
        
        this.setupCamera();
        this.setupLighting();
        this.setupCustomMaterials();
        this.setupResizeListener();
        await this.loadAssets();
        
        // Start render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        
        console.log("✅ Render Engine initialized!");
    }

    private setupCamera(): void {
        // Create ArcRotateCamera with desired position
        this.camera = new ArcRotateCamera("camera", -1.569, 0.593, 43.461, Vector3.Zero(), this.scene);
        
        // Lock the camera - disable all controls
        this.camera.attachControl(this.canvas, false);
        this.camera.inputs.clear();
        
        this.scene.activeCamera = this.camera;
        console.log("📷 Camera locked at desired position");
    }

    private setupLighting(): void {
        console.log("💡 Setting up lighting system...");
        // Lighting will be set up after assets are loaded
    }

    private setupCustomMaterials(): void {
        this.createSkybox();
    }

    private createSkybox(): void {
        const skybox = MeshBuilder.CreateBox("skybox", {size: 1000}, this.scene);
        
        const skyboxMaterial = new StandardMaterial("skyboxMaterial", this.scene);
        skyboxMaterial.backFaceCulling = false;
        
        skyboxMaterial.diffuseTexture = new Texture("public/textures/starfield.png", this.scene);
        skyboxMaterial.diffuseTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
        skyboxMaterial.diffuseTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
        
        skyboxMaterial.emissiveTexture = skyboxMaterial.diffuseTexture;
        skyboxMaterial.emissiveColor = new Color3(1.0, 1.0, 1.0);
        skyboxMaterial.specularColor = new Color3(0, 0, 0);
        skyboxMaterial.disableLighting = true;
        
        skybox.material = skyboxMaterial;
        skybox.infiniteDistance = true;
        skybox.parent = this.scene.activeCamera;
        
        // Add rotation animation
        this.scene.registerBeforeRender(() => {
            skybox.rotation.y += 0.001;
        });
    }

    private async loadAssets(): Promise<void> {
        console.log("📦 Loading game assets...");
        
        try {
            const container = await SceneLoader.LoadAssetContainerAsync("/public/models/", "game.glb", this.scene);
            container.addAllToScene();
            console.log("📦 Assets loaded successfully");
            
            this.initializeGameObjects();
            this.positionObjects();
            this.createStrongLightingForGameObjects();
            this.createInvisibleWalls();
            
        } catch (error) {
            console.log("🔍 Trying alternative path...");
            try {
                const container = await SceneLoader.LoadAssetContainerAsync("./public/models/", "game.glb", this.scene);
                container.addAllToScene();
                console.log("📦 Assets loaded with alternative path");
                
                this.initializeGameObjects();
                this.positionObjects();
                this.createStrongLightingForGameObjects();
                this.createInvisibleWalls();
                
            } catch (err2) {
                console.error("❌ Failed to load assets:", err2);
            }
        }
    }

    private initializeGameObjects(): void {
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

    private positionObjects(): void {
        const objectPositions: { [key: string]: Vector3 } = {
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

    private createStrongLightingForGameObjects(): void {
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

    private makePaddleEmitLight(parentMesh: AbstractMesh, lightColor: Color3, side: string): void {
        const emissiveMaterial = new PBRMaterial(`${parentMesh.name}_emissive`, this.scene);
        
        if (side === 'left') {
            emissiveMaterial.albedoColor = new Color3(0.05, 0.15, 0.20);
        } else {
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

    private createLightBlocker(parentMesh: AbstractMesh, side: string): void {
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
            } else {
                blocker.rotation.y = offset.x > 0 ? -Math.PI/2 : Math.PI/2;
            }
        });
    }

    private createInvisibleWalls(): void {
        const floorPlane = this.scene.getMeshByName('floorPlane');
        if (!floorPlane) {
            console.warn("⚠️ Floor plane not found, using default boundaries");
            return;
        }

        floorPlane.computeWorldMatrix(true);
        floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
        
        const boundingBox = floorPlane.getBoundingInfo().boundingBox;
        const floorMinZ = boundingBox.minimumWorld.z;
        const floorMaxZ = boundingBox.maximumWorld.z;
        const floorMinX = boundingBox.minimumWorld.x;
        const floorMaxX = boundingBox.maximumWorld.x;
        const floorY = boundingBox.maximumWorld.y;
        
        const wallHeight = 5.0;
        const wallThickness = 0.1;
        const wallWidth = Math.abs(floorMaxX - floorMinX) + 2;
        
        // Create forward wall
        const forwardWall = MeshBuilder.CreateBox("forwardWall", {
            width: wallWidth,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        
        forwardWall.position = new Vector3(
            (floorMinX + floorMaxX) / 2,
            floorY + (wallHeight / 2),
            floorMaxZ + (wallThickness / 2)
        );
        
        // Create backward wall
        const backwardWall = MeshBuilder.CreateBox("backwardWall", {
            width: wallWidth,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        
        backwardWall.position = new Vector3(
            (floorMinX + floorMaxX) / 2,
            floorY + (wallHeight / 2),
            floorMinZ - (wallThickness / 2)
        );
        
        const invisibleMaterial = new StandardMaterial("invisibleWallMaterial", this.scene);
        invisibleMaterial.alpha = 0.0;
        invisibleMaterial.disableLighting = true;
        
        forwardWall.material = invisibleMaterial;
        backwardWall.material = invisibleMaterial;
        
        forwardWall.isPickable = true;
        backwardWall.isPickable = true;
        forwardWall.checkCollisions = false;
        backwardWall.checkCollisions = false;
        
        console.log("🚧 Created invisible walls for collision detection");
    }

    private setupResizeListener(): void {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    getGameObject(name: string): GameObject3D | undefined {
        return this.gameObjects.get(name);
    }

    getMesh(name: string): AbstractMesh | null {
        return this.scene.getMeshByName(name);
    }

    getScene(): Scene {
        return this.scene;
    }

    update(deltaTime: number): void {
        this.gameObjects.forEach(obj => obj.update(deltaTime));
    }

    render(): void {
        // Rendering is handled by the engine's render loop
    }

    dispose(): void {
        this.scene.dispose();
        this.engine.dispose();
    }
}

// =====================================
// GAME OBJECT 3D WRAPPER
// =====================================
class GameObject3D {
    constructor(
        public mesh: AbstractMesh,
        public type: 'paddle' | 'ball' | 'wall'
    ) {}

    get position(): Vector3 {
        return this.mesh.position;
    }

    set position(pos: Vector3) {
        this.mesh.position.copyFrom(pos);
    }

    getBounds(): BoundingBox {
        this.mesh.computeWorldMatrix(true);
        this.mesh.getBoundingInfo().update(this.mesh.getWorldMatrix());
        return this.mesh.getBoundingInfo().boundingBox;
    }

    update(deltaTime: number): void {
        // Any per-frame updates for this object
    }
}

// =====================================
// PHYSICS SYSTEM
// =====================================
class PhysicsSystem {
    private ballVelocity: Vector3 = Vector3.Zero();
    private ballSpeed: number = 2;
    private ballActive: boolean = false;
    private renderEngine: RenderEngine | null = null;

    initialize(): void {
        console.log("⚡ Physics system initialized");
    }

    setRenderEngine(renderEngine: RenderEngine): void {
        this.renderEngine = renderEngine;
    }

    startBall(): void {
        if (!this.renderEngine) return;
        
        this.resetBallPosition();
        this.startBallMovement();
        this.ballActive = true;
        console.log("🏐 Ball movement started");
    }

    resumeBall(): void {
        if (!this.renderEngine) return;
        
        // Resume ball without resetting position
        this.ballActive = true;
        console.log("🏐 Ball movement resumed");
    }

    stopBall(): void {
        this.ballActive = false;
        console.log("🏐 Ball movement stopped");
    }

    private resetBallPosition(): void {
        if (!this.renderEngine) return;
        
        const ball = this.renderEngine.getMesh('pongBall');
        if (ball) {
            ball.position = new Vector3(0.00, 0.78, 0.00);
        }
    }

    private startBallMovement(): void {
        const angleRange = Math.PI / 3;
        const randomAngle = (Math.random() - 0.5) * angleRange;
        const direction = Math.random() < 0.5 ? 1 : -1;
        
        this.ballVelocity = new Vector3(
            direction * this.ballSpeed * Math.cos(randomAngle),
            0,
            this.ballSpeed * Math.sin(randomAngle)
        );
    }

    updatePaddlePosition(paddleName: string, inputDirection: number): void {
        if (!this.renderEngine || inputDirection === 0) return;
        
        const paddle = this.renderEngine.getMesh(paddleName);
        if (!paddle) return;
        
        const moveSpeed = 0.2;
        const intendedNewPosition = paddle.position.add(new Vector3(0, 0, inputDirection * moveSpeed));
        
        // Collision detection logic (simplified from your original)
        if (this.canPaddleMoveTo(paddle, intendedNewPosition)) {
            paddle.position.z = intendedNewPosition.z;
        }
    }

    private canPaddleMoveTo(paddle: AbstractMesh, newPosition: Vector3): boolean {
        if (!this.renderEngine) return false;
        
        const floorPlane = this.renderEngine.getMesh('floorPlane');
        if (!floorPlane) return true;
        
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

    update(deltaTime: number): void {
        if (!this.ballActive || !this.renderEngine) return;
        
        this.updateBallPosition(deltaTime);
    }

    private updateBallPosition(deltaTime: number): void {
        if (!this.renderEngine) return;
        
        const ball = this.renderEngine.getMesh('pongBall');
        if (!ball) return;
        
        // Move ball
        const movement = this.ballVelocity.scale(deltaTime / 1000);
        ball.position.addInPlace(movement);
        
        // Check collisions
        this.checkBallCollisions(ball);
    }

    private checkBallCollisions(ball: AbstractMesh): void {
        this.checkWallCollisions(ball);
        this.checkPaddleCollisions(ball);
    }

    private checkWallCollisions(ball: AbstractMesh): void {
        if (!this.renderEngine) return;
        
        const floorPlane = this.renderEngine.getMesh('floorPlane');
        if (!floorPlane) return;
        
        floorPlane.computeWorldMatrix(true);
        floorPlane.getBoundingInfo().update(floorPlane.getWorldMatrix());
        const floorBounds = floorPlane.getBoundingInfo().boundingBox;
        
        const ballRadius = 0.39;
        
        if (ball.position.z + ballRadius >= floorBounds.maximumWorld.z) {
            this.ballVelocity.z = -Math.abs(this.ballVelocity.z);
            ball.position.z = floorBounds.maximumWorld.z - ballRadius;
        }
        
        if (ball.position.z - ballRadius <= floorBounds.minimumWorld.z) {
            this.ballVelocity.z = Math.abs(this.ballVelocity.z);
            ball.position.z = floorBounds.minimumWorld.z + ballRadius;
        }
    }

    private checkPaddleCollisions(ball: AbstractMesh): void {
        if (!this.renderEngine) return;
        
        const leftPaddle = this.renderEngine.getMesh('paddleLeft');
        const rightPaddle = this.renderEngine.getMesh('paddleRight');
        
        if (leftPaddle && this.ballVelocity.x < 0) {
            if (this.isBallCollidingWithPaddle(ball, leftPaddle)) {
                this.handlePaddleCollision(ball, leftPaddle, 'left');
            }
        }
        
        if (rightPaddle && this.ballVelocity.x > 0) {
            if (this.isBallCollidingWithPaddle(ball, rightPaddle)) {
                this.handlePaddleCollision(ball, rightPaddle, 'right');
            }
        }
    }

    private isBallCollidingWithPaddle(ball: AbstractMesh, paddle: AbstractMesh): boolean {
        paddle.computeWorldMatrix(true);
        paddle.getBoundingInfo().update(paddle.getWorldMatrix());
        const paddleBounds = paddle.getBoundingInfo().boundingBox;
        
        const ballRadius = 0.39;
        const ballLeft = ball.position.x - ballRadius;
        const ballRight = ball.position.x + ballRadius;
        const ballTop = ball.position.z + ballRadius;
        const ballBottom = ball.position.z - ballRadius;
        
        const paddleLeft = paddleBounds.minimumWorld.x;
        const paddleRight = paddleBounds.maximumWorld.x;
        const paddleTop = paddleBounds.maximumWorld.z;
        const paddleBottom = paddleBounds.minimumWorld.z;
        
        const xOverlap = ballRight >= paddleLeft && ballLeft <= paddleRight;
        const zOverlap = ballTop >= paddleBottom && ballBottom <= paddleTop;
        
        return xOverlap && zOverlap;
    }

    private handlePaddleCollision(ball: AbstractMesh, paddle: AbstractMesh, side: string): void {
        this.ballVelocity.x = -this.ballVelocity.x;
        
        paddle.computeWorldMatrix(true);
        paddle.getBoundingInfo().update(paddle.getWorldMatrix());
        const paddleBounds = paddle.getBoundingInfo().boundingBox;
        
        const paddleCenter = (paddleBounds.minimumWorld.z + paddleBounds.maximumWorld.z) / 2;
        const paddleHeight = paddleBounds.maximumWorld.z - paddleBounds.minimumWorld.z;
        const hitPosition = (ball.position.z - paddleCenter) / (paddleHeight / 2);
        
        const maxAngleChange = 0.1;
        this.ballVelocity.z += hitPosition * maxAngleChange;
        
        const currentSpeed = this.ballVelocity.length();
        if (currentSpeed > 0) {
            this.ballVelocity.normalize();
            this.ballVelocity.scaleInPlace(this.ballSpeed);
        }
        
        if (side === 'left') {
            ball.position.x = paddleBounds.maximumWorld.x + 0.5;
        } else {
            ball.position.x = paddleBounds.minimumWorld.x - 0.5;
        }
        
        console.log(`🏐 Ball hit ${side} paddle`);
    }

    dispose(): void {
        this.ballActive = false;
    }
}

// =====================================
// INPUT MANAGER
// =====================================
class InputManager {
    private keyStates: Map<string, boolean> = new Map();
    private inputHandlers: Map<string, (pressed: boolean) => void> = new Map();

    initialize(): void {
        this.setupEventListeners();
        console.log("🎮 Input manager initialized");
    }

    private setupEventListeners(): void {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (!this.keyStates.get(key)) {
                this.keyStates.set(key, true);
                const handler = this.inputHandlers.get(key);
                if (handler) handler(true);
            }
        });

        window.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            this.keyStates.set(key, false);
            const handler = this.inputHandlers.get(key);
            if (handler) handler(false);
        });
    }

    isKeyPressed(key: string): boolean {
        return this.keyStates.get(key.toLowerCase()) || false;
    }

    registerHandler(key: string, handler: (pressed: boolean) => void): void {
        this.inputHandlers.set(key.toLowerCase(), handler);
    }

    unregisterHandler(key: string): void {
        this.inputHandlers.delete(key.toLowerCase());
    }

    dispose(): void {
        this.inputHandlers.clear();
        this.keyStates.clear();
    }
}

// =====================================
// SCORE MANAGER
// =====================================
class ScoreManager {
    private leftScore: number = 0;
    private rightScore: number = 0;
    private onScoreChange?: (leftScore: number, rightScore: number) => void;

    initialize(): void {
        console.log("📊 Score manager initialized");
    }

    setScoreChangeCallback(callback: (leftScore: number, rightScore: number) => void): void {
        this.onScoreChange = callback;
    }

    scorePoint(side: 'left' | 'right'): void {
        if (side === 'left') {
            this.leftScore++;
        } else {
            this.rightScore++;
        }
        
        console.log(`🎯 ${side} player scores! Score: ${this.leftScore} - ${this.rightScore}`);
        
        if (this.onScoreChange) {
            this.onScoreChange(this.leftScore, this.rightScore);
        }
    }

    getScore(): { left: number, right: number } {
        return { left: this.leftScore, right: this.rightScore };
    }

    reset(): void {
        this.leftScore = 0;
        this.rightScore = 0;
        
        if (this.onScoreChange) {
            this.onScoreChange(this.leftScore, this.rightScore);
        }
    }
}

// =====================================
// GAME STATE MANAGER
// =====================================
interface SystemReferences {
    renderEngine: RenderEngine; 
    inputManager: InputManager; 
    physicsSystem: PhysicsSystem;
    audioManager: AudioManager;
    uiManager: UIManager;
    scoreManager: ScoreManager;

}

class GameStateManager {
    private currentState: GameState | null = null;
    private states: Map<string, GameState> = new Map();
    private systems: SystemReferences;

    constructor(systems: SystemReferences) {
        this.systems = systems;
        this.initializeStates();
    }

    private initializeStates(): void {
        this.states.set('menu', new MenuState(this.systems, this));
        this.states.set('loading', new LoadingState(this.systems, this));
        this.states.set('playing', new PlayingState(this.systems, this));
        this.states.set('paused', new PausedState(this.systems, this));
        this.states.set('gameOver', new GameOverState(this.systems, this));
    }

    async setState(stateName: string): Promise<void> {
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

    update(deltaTime: number): void {
        if (this.currentState) {
            this.currentState.update(deltaTime);
        }
    }

    getState(stateName: string): GameState | undefined {
        return this.states.get(stateName);
    }
}

// =====================================
// GAME STATES
//
// Abstract classes
// =====================================
abstract class GameState {
    constructor(
        protected systems: SystemReferences,
        protected stateManager: GameStateManager
    ) {}

    abstract enter(): void | Promise<void>;
    abstract exit(): void;
    abstract update(deltaTime: number): void;
}

class MenuState extends GameState {
    enter(): void {
        console.log("📋 Entered Menu State");

        this.systems.inputManager.registerHandler('enter', (pressed) => {
            if (pressed) {
                this.stateManager.setState('playing');
            }
        });
    }

    exit(): void {
        this.systems.inputManager.unregisterHandler('enter');
    }

    update(deltaTime: number): void {}
}

class LoadingState extends GameState {
    enter(): void {
        console.log("⏳ Entered Loading State");
        // Simulate loading, then transition to countdown
        setTimeout(() => {
            this.stateManager.setState('countdown');
        }, 1000);
    }

    exit(): void {}
    update(deltaTime: number): void {}
}

class PlayingState extends GameState {
    private isResumingFromPause: boolean = false;

    setResumingFromPause(resuming: boolean): void {
        this.isResumingFromPause = resuming;
    }

    async enter(): Promise<void> {
        console.log("🎮 Entered Playing State");
        // Set up physics system
        this.systems.physicsSystem.setRenderEngine(this.systems.renderEngine);
        
        if (this.isResumingFromPause) {
            console.log("🎮 Resuming from pause - skipping countdown");
            this.systems.physicsSystem.resumeBall();
        } else {
            console.log("🎮 Starting fresh game - doing countdown");
            await this.countdown();
            this.systems.physicsSystem.startBall();
        }
        
        this.setupInputHandlers();
        this.isResumingFromPause = false; // Reset flag after use
    }

    exit(): void {
        this.cleanupInputHandlers();
        this.systems.physicsSystem.stopBall();
    }

    update(deltaTime: number): void {
        this.updatePaddleMovement();
    }

    private countdown(): Promise<void> {
        return new Promise((resolve) => {
            let countdown = 3;
        
            const timer = setInterval(() => {
                console.log(countdown);
                countdown--;
                if (countdown < 0) {
                    clearInterval(timer);
                    console.log("Countdown finished!");
                    resolve();
                }
            }, 1000);
        });
    }

    private setupInputHandlers(): void {
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                this.stateManager.setState('paused');
            }
        });
    }

    private updatePaddleMovement(): void {
        // Left paddle movement
        let leftInput = 0;
        if (this.systems.inputManager.isKeyPressed('a')) leftInput -= 1;
        if (this.systems.inputManager.isKeyPressed('d')) leftInput += 1;
        
        if (leftInput !== 0) {
            this.systems.physicsSystem.updatePaddlePosition('paddleLeft', leftInput);
        }

        // Right paddle movement
        let rightInput = 0;
        if (this.systems.inputManager.isKeyPressed('arrowleft')) rightInput -= 1;
        if (this.systems.inputManager.isKeyPressed('arrowright')) rightInput += 1;
        
        if (rightInput !== 0) {
            this.systems.physicsSystem.updatePaddlePosition('paddleRight', rightInput);
        }
    }

    private cleanupInputHandlers(): void {
        this.systems.inputManager.unregisterHandler(' ');
    }
}

class PausedState extends GameState {
    enter(): void {
        console.log("⏸️ Entered Paused State");
        
        this.systems.inputManager.registerHandler(' ', (pressed) => {
            if (pressed) {
                // Set resume flag before transitioning
                const playingState = this.stateManager.getState('playing') as PlayingState;
                if (playingState) {
                    playingState.setResumingFromPause(true);
                }
                this.stateManager.setState('playing');
            }
        });
        
        this.systems.inputManager.registerHandler('escape', (pressed) => {
            if (pressed) {
                this.stateManager.setState('menu');
            }
        });
    }

    exit(): void {
        this.systems.inputManager.unregisterHandler(' ');
        this.systems.inputManager.unregisterHandler('escape');
    }

    update(deltaTime: number): void {}
}

class GameOverState extends GameState {
    enter(): void {
        console.log("🏁 Entered Game Over State");
        
        this.systems.inputManager.registerHandler('r', (pressed) => {
            if (pressed) {
                this.systems.scoreManager.reset();
                this.stateManager.setState('countdown');
            }
        });
        
        this.systems.inputManager.registerHandler('escape', (pressed) => {
            if (pressed) {
                this.stateManager.setState('menu');
            }
        });
    }

    exit(): void {
        this.systems.inputManager.unregisterHandler('r');
        this.systems.inputManager.unregisterHandler('escape');
    }

    update(deltaTime: number): void {}
}

// =====================================
// SUPPORTING SYSTEMS
// =====================================
class AudioManager {
    initialize(): void {
        console.log("🔊 Audio manager initialized");
    }

    play(soundName: string): void {
        console.log(`🔊 Playing sound: ${soundName}`);
    }

    dispose(): void {}
}

class UIManager {
    initialize(): void {
        console.log("🖥️ UI manager initialized");
    }

    update(deltaTime: number): void {}
    render(): void {}
    dispose(): void {}
}

// =====================================
// INITIALIZATION
// =====================================
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    
    if (!canvas) {
        console.error("❌ Canvas element with id 'renderCanvas' not found.");
        return;
    }

    console.log("🚀 Starting Pong Game...");
    new PongGameManager(canvas);
});