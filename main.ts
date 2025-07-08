import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import "@babylonjs/loaders/glTF"; // Required for loading .glb/.gltf

class GLBScene {
    private scene: Scene;
    private engine: Engine;

    constructor(private canvas: HTMLCanvasElement) {
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);

        this.setupCamera();
        this.setupLighting();
        this.setupCustomMaterials();
        this.setupResizeListener();
        this.setupScene();
    }

    private setupResizeListener(): void {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private setupCamera(): void {
        // Initial camera setup - will be repositioned after floor_plane is found
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene);
        camera.attachControl(this.canvas, true);
        this.scene.activeCamera = camera;
    }

    private repositionCameraForSideView(): void {
        const floorPlane = this.scene.getMeshByName("floor_plane");
        if (floorPlane && this.scene.activeCamera) {
            const camera = this.scene.activeCamera as ArcRotateCamera;
            
            // Position camera for side view - slightly above and to the side
            camera.setTarget(floorPlane.position);
            camera.alpha = -Math.PI / 2; // Side view angle
            camera.beta = Math.PI / 3; // Slightly above angle
            camera.radius = 15; // Distance from target
            
            console.log("📹 Camera repositioned for side view based on floor_plane");
        } else {
            console.warn("⚠️ floor_plane not found - camera remains at default position");
        }
    }

    private setupLighting(): void {
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.3; // Dimmer for glow effects
    }

    private setupCustomMaterials(): void {
        this.createBackgroundLayers();
    }

    private createBackgroundLayers(): void {
        // 1. Space Gradient (furthest back)
        const spaceGradient = MeshBuilder.CreatePlane("spaceGradient", {size: 50}, this.scene);
        spaceGradient.position.z = 20; // Far behind gameplay
        
        const spaceGradientMat = new StandardMaterial("spaceGradientMat", this.scene);
        spaceGradientMat.diffuseTexture = new Texture("textures/space_gradient.png", this.scene);
        spaceGradientMat.emissiveTexture = spaceGradientMat.diffuseTexture;
        spaceGradientMat.emissiveColor = new Color3(0.3, 0.3, 0.5);
        spaceGradient.material = spaceGradientMat;
        
        // 2. Starfield (middle layer)
        const starfield = MeshBuilder.CreatePlane("starfield", {size: 40}, this.scene);
        starfield.position.z = 15; // In front of gradient, behind gameplay
        
        const starfieldMat = new StandardMaterial("starfieldMat", this.scene);
        starfieldMat.diffuseTexture = new Texture("textures/starfield_bg.png", this.scene);
        starfieldMat.emissiveTexture = starfieldMat.diffuseTexture;
        starfieldMat.emissiveColor = new Color3(0.8, 0.8, 1.0);
        starfieldMat.diffuseTexture.hasAlpha = true; // Important for transparency
        starfield.material = starfieldMat;
    }

    private setupScene(): void {
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
            
            // Reposition camera based on floor_plane
            this.repositionCameraForSideView();
        }).catch((err) => {
            console.error("❌ Failed to load GLB scene:", err);
            console.log("🔍 Trying alternative path: ./public/models/game.glb");
            
            // Try alternative path
            SceneLoader.LoadAssetContainerAsync("./public/models/", "game.glb", this.scene).then((container) => {
                console.log("✅ GLB loaded with alternative path:", container);
                container.addAllToScene();
                console.log("📦 Added all meshes to scene");
                
                // Reposition camera based on floor_plane
                this.repositionCameraForSideView();
            }).catch((err2) => {
                console.error("❌ Alternative path also failed:", err2);
            });
        });
    }

    public dispose(): void {
        this.scene.dispose();
        this.engine.dispose();
    }
}

// ✅ Entry point
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

    if (!canvas) {
        console.error("❌ Canvas element with id 'renderCanvas' not found.");
        return;
    }

    new GLBScene(canvas);
});
