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
import "@babylonjs/loaders/glTF"; // Required for loading .glb/.gltf
class GLBScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
        this.setupCamera();
        this.setupLighting();
        this.setupCustomMaterials();
        this.setupResizeListener();
        this.setupScene();
    }
    setupResizeListener() {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }
    setupCamera() {
        // Initial camera setup - will be repositioned after floor_plane is found
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene);
        camera.attachControl(this.canvas, true);
        this.scene.activeCamera = camera;
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
            if (event.key === 'c' || event.key === 'C') {
                this.logAllObjectCoordinates();
            }
        });
    }
    displayCoordinateOnPage(meshName, position) {
        // Remove existing coordinate display
        const existing = document.getElementById('coordinateDisplay');
        if (existing)
            existing.remove();
        // Create coordinate display element
        const display = document.createElement('div');
        display.id = 'coordinateDisplay';
        display.innerHTML = `
            <strong>${meshName}</strong><br>
            X: ${position.x.toFixed(2)}<br>
            Y: ${position.y.toFixed(2)}<br>
            Z: ${position.z.toFixed(2)}
        `;
        display.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
            z-index: 1000;
            pointer-events: none;
        `;
        document.body.appendChild(display);
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (document.getElementById('coordinateDisplay')) {
                document.getElementById('coordinateDisplay')?.remove();
            }
        }, 3000);
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
        });
        window.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            inputMap[key] = false;
            console.log(`🔼 Key released: ${key}`);
        });
        // Update paddles each frame
        this.scene.registerBeforeRender(() => {
            const leftPaddle = this.scene.getMeshByName('paddleLeft');
            const rightPaddle = this.scene.getMeshByName('paddleRight');
            if (leftPaddle) {
                let leftInput = 0;
                if (inputMap['a'])
                    leftInput += 1; // Left on Z-axis
                if (inputMap['d'])
                    leftInput -= 1; // Right on Z-axis
                if (leftInput !== 0) {
                    console.log(`⬅️ Left paddle input: ${leftInput}`);
                }
                this.updatePaddlePosition(leftPaddle, leftInput);
            }
            if (rightPaddle) {
                let rightInput = 0;
                if (inputMap['arrowright'])
                    rightInput += 1; // Right on Z-axis
                if (inputMap['arrowleft'])
                    rightInput -= 1; // Left on Z-axis
                if (rightInput !== 0) {
                    console.log(`➡️ Right paddle input: ${rightInput}`);
                }
                this.updatePaddlePosition(rightPaddle, rightInput);
            }
        });
        console.log("🎮 Paddle controls initialized! Use A/D for left, Arrow Left/Right for right");
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
            new Vector3(paddle.position.x - (paddleWidth / 2) + 0.1, paddle.position.y - (paddleHeight / 2) + 0.1, currentLeadingEdgeZ),
            new Vector3(paddle.position.x + (paddleWidth / 2) - 0.1, paddle.position.y - (paddleHeight / 2) + 0.1, currentLeadingEdgeZ)
        ];
        // Ray direction: continue in movement direction from current leading edge
        const rayDirection = new Vector3(0, 0, inputDirection).normalize();
        const rayDistance = moveSpeed + 0.01; // Just slightly more than move distance
        let collisionDetected = false;
        let closestDistance = Infinity;
        let hitWallName = "";
        // Enable ray visualization for debugging
        this.debugVisualizeRays(rayStartPositions, rayDirection, rayDistance);
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
        this.scene.dispose();
        this.engine.dispose();
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