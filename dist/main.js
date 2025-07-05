import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF"; // Required for loading .glb/.gltf
class GLBScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
        this.setupResizeListener();
        this.setupScene();
    }
    setupResizeListener() {
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }
    setupScene() {
        this.engine.displayLoadingUI();
        // ✅ Append entire .glb scene to the current scene
        SceneLoader.LoadAssetContainerAsync("/models/", "Scene_7.glb", this.scene).then(() => {
            this.scene.executeWhenReady(() => {
                this.engine.hideLoadingUI();
                this.engine.runRenderLoop(() => {
                    this.scene.render();
                });
            });
        }).catch((err) => {
            console.error("❌ Failed to load GLB scene:", err);
            this.engine.hideLoadingUI();
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