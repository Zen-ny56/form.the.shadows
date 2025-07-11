import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
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