import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

export class GLBScene {
    scene: Scene;
    engine: Engine;

    constructor(private canvas: HTMLCanvasElement) {
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);

        this.setupResizeListener(); // ✅ (1) Handle window resizing
        this.setupScene();          // ✅ (6) Scene setup hook
    }

    // Window is a global object crear
    private setupResizeListener(): void {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private setupScene(): void {
        this.engine.displayLoadingUI(); // ✅ (4) Show loading screen

        // Optional: Fallback camera and light if GLB has none
        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene);
        camera.attachControl(this.canvas, true);
        new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        LoadAssetContainerAsync("/models/", "Scene_7.glb", this.engine).then((container) => {
            container.addAllToScene();


            this.scene.executeWhenReady(() => {
                this.onSceneReady(); // ✅ (6) Lifecycle hook

                this.engine.hideLoadingUI(); // ✅ (4) Hide loading screen

                this.engine.runRenderLoop(() => {
                    this.onRenderFrame(); // ✅ (6) Render hook
                });
            });
        });
    }

    // ✅ (6) Called when the scene is fully ready
    private onSceneReady(): void {
        this.scene.meshes.forEach(mesh => {
            console.log("Found mesh:", mesh.name);
        });

        const myModel = this.scene.getMeshByName("MyCharacter");
        if (myModel) {
            myModel.position.x += 1;
            myModel.rotation.y += Math.PI / 2;
        }
    }

    // ✅ (6) Called every frame
    private onRenderFrame(): void {
        this.scene.render();
    }

    // ✅ (2) Cleanup method to dispose scene/engine
    public dispose(): void {
        this.scene.dispose();
        this.engine.dispose();
    }
}
