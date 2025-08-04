export declare class GUIManager {
    private pauseMenu;
    constructor();
    private injectTronStyles;
    createPauseMenu(): void;
    removePauseMenu(): void;
    isPauseMenuVisible(): boolean;
    displayCoordinateOnPage(meshName: string, position: {
        x: number;
        y: number;
        z: number;
    }): void;
    dispose(): void;
}
