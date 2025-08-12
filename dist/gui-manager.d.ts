export declare class GUIManager {
    private pauseMenu;
    private startMenu;
    private countdownEl;
    private defaultTitleImageUrl?;
    constructor();
    private injectTronStyles;
    createPauseMenu(options?: {
        onResume?: () => void;
        onRestart?: () => void;
    }): void;
    removePauseMenu(): void;
    isPauseMenuVisible(): boolean;
    displayCoordinateOnPage(meshName: string, position: {
        x: number;
        y: number;
        z: number;
    }): void;
    dispose(): void;
    createStartMenu(options?: {
        titleImageUrl?: string;
    }): void;
    removeStartMenu(): void;
    updateCountdown(value: number | string): void;
    clearCountdown(): void;
}
