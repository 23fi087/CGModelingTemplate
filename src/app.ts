import * as THREE from 'three';

// Three.jsの型定義がグローバルに存在する場合とモジュールとしてインポートする場合の両方に対応
// const THREE = (_THREE as any).default || _THREE; // ←この行を削除

// --- 型定義 (Interfaces) ---
interface VehicleData {
    initialTileIndex: number;
    color: number;
    ref?: THREE.Group;
}

interface TreeData {
    tileIndex: number;
    height: number;
}

interface ForestRow {
    type: 'forest';
    trees: TreeData[];
}

interface CarRow {
    type: 'car';
    direction: boolean;
    speed: number;
    vehicles: VehicleData[];
}

type RowData = ForestRow | CarRow;

interface PlayerPosition {
    currentRow: number;
    currentTile: number;
}

// --- 定数 (Constants) ---
const CONSTANTS = {
    minTileIndex: -8,
    maxTileIndex: 8,
    get tilesPerRow(): number { return this.maxTileIndex - this.minTileIndex + 1; },
    tileSize: 42,
    stepTime: 0.2, // プレイヤーが1歩進むのにかかる秒数
};

/**
 * ゲーム全体を管理するメインクラス
 */
export class CrossyRoadGame {
    private scene: THREE.Scene;
    private clock: THREE.Clock;
    private renderer: THREE.WebGLRenderer;
    private camera: THREE.OrthographicCamera;
    
    private player: {
        object: THREE.Group;
        body: THREE.Mesh;
        state: { position: PlayerPosition; movesQueue: string[] };
        queueMove: (direction: string) => void;
        stepCompleted: () => void;
    };

    private mapManager: {
        metadata: RowData[];
        endsUpInValidPosition: (currentPosition: PlayerPosition, moves: string[]) => boolean;
    };

    private isGameOver = false;
    private moveClock = new THREE.Clock(false);
    private animationFrameId?: number;
    
    // --- DOM要素とコールバック ---
    private canvas: HTMLCanvasElement;
    private gameOverModal: HTMLElement | null;
    private onGameOver: () => void;

    constructor(canvas: HTMLCanvasElement, gameOverModal?: HTMLElement, onGameOver?: () => void) {
        this.canvas = canvas;
        this.gameOverModal = gameOverModal || null;
        this.onGameOver = onGameOver || (() => {
            if (this.gameOverModal) {
                this.gameOverModal.style.display = 'flex';
            } else {
                console.log("Game Over!");
            }
        });
        
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        
        this.player = this.initPlayer();
        this.mapManager = this.initMapManager();
        this.initLights();
        
        this.camera = this.initCamera();
        this.player.object.add(this.camera);
        
        this.renderer = this.initRenderer();

        // イベントリスナーをバインド
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    // --- 初期化メソッド ---

    private initPlayer() {
        const playerGroup = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(15, 15, 20),
            new THREE.MeshLambertMaterial({ color: 0xffffff })
        );
        body.position.z = 10;
        playerGroup.add(body);
        this.scene.add(playerGroup);

        const state = {
            position: { currentRow: 0, currentTile: 0 },
            movesQueue: [] as string[],
        };

        const queueMove = (direction: string) => {
            if (this.isGameOver) return;
            const isValid = this.mapManager.endsUpInValidPosition(
                state.position,
                [...state.movesQueue, direction]
            );
            if (!isValid) return;
            state.movesQueue.push(direction);
        };

        const stepCompleted = () => {
            const direction = state.movesQueue.shift();
            if (direction === "forward") state.position.currentRow += 1;
            if (direction === "backward") state.position.currentRow -= 1;
            if (direction === "left") state.position.currentTile -= 1;
            if (direction === "right") state.position.currentTile += 1;
        };

        return { object: playerGroup, body, state, queueMove, stepCompleted };
    }

    private initMapManager() {
        const mapGroup = new THREE.Group();
        this.scene.add(mapGroup);
        
        const metadata: RowData[] = [
            { type: "forest", trees: [{ tileIndex: -5, height: 50 }, { tileIndex: 0, height: 30 }, { tileIndex: 3, height: 50 }] },
            { type: "car", direction: true, speed: 125, vehicles: [{ initialTileIndex: -4, color: 0x78b14b }, { initialTileIndex: 0, color: 0xbdb638 }, { initialTileIndex: 5, color: 0xbdb638 }] },
            { type: "car", direction: false, speed: 188, vehicles: [{ initialTileIndex: -4, color: 0xbdb638 }, { initialTileIndex: -1, color: 0x78b14b }, { initialTileIndex: 4, color: 0xa52523 }] },
            { type: "forest", trees: [{ tileIndex: -8, height: 30 }, { tileIndex: -3, height: 50 }, { tileIndex: 2, height: 30 }] },
            { type: "car", direction: true, speed: 150, vehicles: [{ initialTileIndex: -6, color: 0x3498db }, { initialTileIndex: 2, color: 0x9b59b6 }] },
            { type: "forest", trees: [{ tileIndex: -2, height: 40 }, { tileIndex: 4, height: 60 }] },
        ];

        const createGrass = (rowIndex: number) => {
            const grass = new THREE.Group();
            grass.position.y = rowIndex * CONSTANTS.tileSize;
            const foundation = new THREE.Mesh(
                new THREE.BoxGeometry(CONSTANTS.tilesPerRow * CONSTANTS.tileSize, CONSTANTS.tileSize, 3),
                new THREE.MeshLambertMaterial({ color: 0xbaf455 })
            );
            foundation.position.z = 1.5;
            grass.add(foundation);
            return grass;
        };

        const createRoad = (rowIndex: number) => {
            const road = new THREE.Group();
            road.position.y = rowIndex * CONSTANTS.tileSize;
            const foundation = new THREE.Mesh(
                new THREE.PlaneGeometry(CONSTANTS.tilesPerRow * CONSTANTS.tileSize, CONSTANTS.tileSize),
                new THREE.MeshLambertMaterial({ color: 0x454a59 })
            );
            road.add(foundation);
            return road;
        };

        const createTree = (tileIndex: number, height: number) => {
            const tree = new THREE.Group();
            tree.position.x = tileIndex * CONSTANTS.tileSize;
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(15, 15, 20), new THREE.MeshLambertMaterial({ color: 0x4d2926 }));
            trunk.position.z = 10;
            tree.add(trunk);
            const crown = new THREE.Mesh(new THREE.BoxGeometry(30, 30, height), new THREE.MeshLambertMaterial({ color: 0x7aa21d }));
            crown.position.z = height / 2 + 20;
            tree.add(crown);
            return tree;
        };

        const createCar = (initialTileIndex: number, direction: boolean, color: number) => {
            const car = new THREE.Group();
            car.position.x = initialTileIndex * CONSTANTS.tileSize;
            if (!direction) car.rotation.z = Math.PI;

            const main = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 15), new THREE.MeshLambertMaterial({ color }));
            main.position.z = 12;
            car.add(main);
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(33, 24, 12), new THREE.MeshLambertMaterial({ color: "white" }));
            cabin.position.x = -6;
            cabin.position.z = 25.5;
            car.add(cabin);
            const frontWheel = new THREE.Mesh(new THREE.BoxGeometry(12, 33, 12), new THREE.MeshLambertMaterial({ color: 0x333333 }));
            frontWheel.position.x = 18;
            frontWheel.position.z = 6;
            car.add(frontWheel);
            const backWheel = new THREE.Mesh(new THREE.BoxGeometry(12, 33, 12), new THREE.MeshLambertMaterial({ color: 0x333333 }));
            backWheel.position.x = -18;
            backWheel.position.z = 6;
            car.add(backWheel);
            return car;
        };
        
        mapGroup.add(createGrass(0));
        metadata.forEach((rowData, index) => {
            const rowIndex = index + 1;
            let row: THREE.Group;
            if (rowData.type === "forest") {
                row = createGrass(rowIndex);
                rowData.trees.forEach(({ tileIndex, height }) => row.add(createTree(tileIndex, height)));
            } else { // 'car'
                row = createRoad(rowIndex);
                rowData.vehicles.forEach((vehicle) => {
                    const car = createCar(vehicle.initialTileIndex, rowData.direction, vehicle.color);
                    vehicle.ref = car;
                    row.add(car);
                });
            }
            mapGroup.add(row);
        });

        const calculateFinalPosition = (currentPosition: PlayerPosition, moves: string[]): PlayerPosition => {
            return moves.reduce((position, direction) => {
                const newPos = { ...position };
                if (direction === "forward") newPos.currentRow += 1;
                if (direction === "backward") newPos.currentRow -= 1;
                if (direction === "left") newPos.currentTile -= 1;
                if (direction === "right") newPos.currentTile += 1;
                return newPos;
            }, currentPosition);
        };

        const endsUpInValidPosition = (currentPosition: PlayerPosition, moves: string[]): boolean => {
            const finalPosition = calculateFinalPosition(currentPosition, moves);
            if (finalPosition.currentRow < 0 || finalPosition.currentTile < CONSTANTS.minTileIndex || finalPosition.currentTile > CONSTANTS.maxTileIndex) {
                return false;
            }
            const finalRowData = metadata[finalPosition.currentRow - 1];
            if (finalRowData?.type === "forest" && finalRowData.trees.some(tree => tree.tileIndex === finalPosition.currentTile)) {
                return false;
            }
            return true;
        };

        return { metadata, endsUpInValidPosition };
    }

    private initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(-100, -100, 200);
        this.scene.add(dirLight);
    }

    private initCamera(): THREE.OrthographicCamera {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        const d = 300;
        const cam = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 100, 2000);
        cam.position.set(300, -300, 300);
        cam.up.set(0, 0, 1);
        cam.lookAt(0, 0, 0);
        return cam;
    }

    private initRenderer(): THREE.WebGLRenderer {
        const rend = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            canvas: this.canvas,
        });
        rend.setPixelRatio(window.devicePixelRatio);
        rend.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
        return rend;
    }

    // --- ゲームロジックとアニメーション ---

    private animateVehicles(delta: number) {
        const beginningOfRow = (CONSTANTS.minTileIndex - 2) * CONSTANTS.tileSize;
        const endOfRow = (CONSTANTS.maxTileIndex + 2) * CONSTANTS.tileSize;

        this.mapManager.metadata.forEach((rowData) => {
            if (rowData.type === "car") {
                rowData.vehicles.forEach(({ ref }) => {
                    if (!ref) return;
                    const speed = rowData.speed * delta;
                    if (rowData.direction) {
                        ref.position.x += speed;
                        if (ref.position.x > endOfRow) ref.position.x = beginningOfRow;
                    } else {
                        ref.position.x -= speed;
                        if (ref.position.x < beginningOfRow) ref.position.x = endOfRow;
                    }
                });
            }
        });
    }

    private animatePlayer() {
        if (this.player.state.movesQueue.length === 0) return;
        if (!this.moveClock.running) this.moveClock.start();

        const progress = Math.min(1, this.moveClock.getElapsedTime() / CONSTANTS.stepTime);
        
        const startX = this.player.state.position.currentTile * CONSTANTS.tileSize;
        const startY = this.player.state.position.currentRow * CONSTANTS.tileSize;
        let endX = startX, endY = startY;
        const nextMove = this.player.state.movesQueue[0];

        if (nextMove === "left") endX -= CONSTANTS.tileSize;
        if (nextMove === "right") endX += CONSTANTS.tileSize;
        if (nextMove === "forward") endY += CONSTANTS.tileSize;
        if (nextMove === "backward") endY -= CONSTANTS.tileSize;

        this.player.object.position.x = THREE.MathUtils.lerp(startX, endX, progress);
        this.player.object.position.y = THREE.MathUtils.lerp(startY, endY, progress);
        this.player.body.position.z = Math.sin(progress * Math.PI) * 8 + 10;

        if (progress >= 1) {
            this.player.stepCompleted();
            this.moveClock.stop();
        }
    }
    
    private playerBoundingBox = new THREE.Box3();
    private vehicleBoundingBox = new THREE.Box3();
    private hitTest() {
        const rowData = this.mapManager.metadata[this.player.state.position.currentRow - 1];
        if (!rowData || rowData.type !== 'car') return;

        this.playerBoundingBox.setFromObject(this.player.body);

        rowData.vehicles.forEach(({ ref }) => {
            if (!ref) return;
            this.vehicleBoundingBox.setFromObject(ref);
            if (this.playerBoundingBox.intersectsBox(this.vehicleBoundingBox)) {
                this.endGame();
            }
        });
    }
    
    private endGame() {
        this.isGameOver = true;
        this.onGameOver();
    }

    private animate() {
        if (this.isGameOver) return;
        
        const delta = this.clock.getDelta();
        
        this.animateVehicles(delta);
        this.animatePlayer();
        this.hitTest();

        this.renderer.render(this.scene, this.camera);
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    // --- イベントハンドラ ---

    private handleKeyDown(event: KeyboardEvent) {
        if (event.key === "ArrowUp") this.player.queueMove("forward");
        else if (event.key === "ArrowDown") this.player.queueMove("backward");
        else if (event.key === "ArrowLeft") this.player.queueMove("left");
        else if (event.key === "ArrowRight") this.player.queueMove("right");
    }

    private handleResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        const aspect = width / height;
        const d = 300;
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }
    
    // --- パブリックメソッド ---

    /**
     * ゲームを開始し、アニメーションループを起動します。
     */
    public start() {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('resize', this.handleResize);
        this.animate();
    }

    /**
     * ゲームを停止し、イベントリスナーをクリーンアップします。
     */
    public stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('resize', this.handleResize);
    }
}

/*
// --- 使用例 (Example Usage) ---
// 以下のコードは、HTMLファイルに <canvas id="game-canvas"></canvas> が存在することを想定しています。

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const gameOverModal = document.getElementById('game-over-modal'); // オプション

if (canvas) {
    const game = new CrossyRoadGame(canvas, gameOverModal);
    game.start();

    // リスタートボタンのロジック
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            window.location.reload();
        });
    }
} else {
    console.error("Canvas with id 'game-canvas' not found.");
}
*/
