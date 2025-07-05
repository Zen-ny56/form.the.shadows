import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/loaders/glTF"; // Required for loading .glb/.gltf

class GLBScene {
    private scene: Scene;
    private engine: Engine;

    constructor(private canvas: HTMLCanvasElement) {
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);

        this.setupCamera();
        this.setupLighting();
        this.setupResizeListener();
        this.setupScene();
    }

    private setupResizeListener(): void {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private setupCamera(): void {
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene);
        camera.attachControl(this.canvas, true);
        this.scene.activeCamera = camera;
    }

    private setupLighting(): void {
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;
    }

    private setupScene(): void {
        // Start render loop immediately so we can see the camera/lighting
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        // ✅ Append entire .glb scene to the current scene
        console.log("🔍 Attempting to load GLB from: /public/models/Scene_7.glb");
        SceneLoader.LoadAssetContainerAsync("/public/models/", "Scene_7.glb", this.scene).then((container) => {
            console.log("✅ GLB loaded successfully:", container);
            container.addAllToScene();
            console.log("📦 Added all meshes to scene");
        }).catch((err) => {
            console.error("❌ Failed to load GLB scene:", err);
            console.log("🔍 Trying alternative path: ./public/models/Scene_7.glb");
            
            // Try alternative path
            SceneLoader.LoadAssetContainerAsync("./public/models/", "Scene_7.glb", this.scene).then((container) => {
                console.log("✅ GLB loaded with alternative path:", container);
                container.addAllToScene();
                console.log("📦 Added all meshes to scene");
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
