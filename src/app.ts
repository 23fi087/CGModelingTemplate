
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
const gltfLoader = new GLTFLoader();

// --- GAME CONSTANTS ---
const CONSTANTS = {
    minTileIndex: -12,
    maxTileIndex: 12,
    get tilesPerRow() { return this.maxTileIndex - this.minTileIndex + 1; },
    tileSize: 42,
    stepTime: 0.22,
    PLAYER_MELEE_RANGE: 120,
};

// --- GAME STATE ---
let gameState = {
    isGameOver: false,
    isInteractionActive: false,
    currentInteraction: null,
    gameStarted: false,
    isCheatModeActive: false,
    activeTeleportEffect: null,
    hasTeleportedToBoss: false,
    isInvincible: false, // ★無敵フラグ追加
};

// --- CORE THREE.JS COMPONENTS ---
const scene = new THREE.Scene();
const clock = new THREE.Clock();

// --- UI ELEMENTS ---
const uiContainer = document.getElementById('ui-container') as HTMLDivElement;
const messageText = document.getElementById('message-text') as HTMLParagraphElement;
const hpValueText = document.getElementById('hp-value') as HTMLSpanElement;
const hpBar = document.getElementById('hp-bar') as HTMLDivElement;

// UIパネルのテキストを日本語に
// info-panelの内容
(document.getElementById('info-panel') as HTMLDivElement).children[0].textContent = 'WASD: 移動 | E: 剣を振る | スペース: 調べる | C: チートモード';

// --- PLAYER MODULE ---
const Player = (() => {
    const playerGroup = new THREE.Group();
    const swordGroup = new THREE.Group();
    const shieldMesh = new THREE.Mesh(new THREE.BoxGeometry(15, 5, 20), new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
    shieldMesh.position.set(-12, 0, 10);
    shieldMesh.visible = false;
    playerGroup.add(shieldMesh);
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(15, 15, 20), new THREE.MeshLambertMaterial({ color: 0x3498db }));
    body.position.z = 10;
    playerGroup.add(body);

    const swordHilt = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 10), new THREE.MeshLambertMaterial({ color: 0x654321 }));
    swordHilt.position.set(0, 0, 5);
    const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 25), new THREE.MeshLambertMaterial({ color: 0xc0c0c0 }));
    swordBlade.position.set(0, 0, 20);
    swordGroup.add(swordHilt);
    swordGroup.add(swordBlade);
    swordGroup.position.set(10, 0, 10);
    playerGroup.add(swordGroup);

    scene.add(playerGroup);

    const state = {
        position: { currentRow: 0, currentTile: 0 },
        movesQueue: [],
        maxHp: 100,
        hp: 100,
        attack: 25,
        defense: 0,
        hasShield: false,
        isBlocking: false,
        isAttacking: false,
        attackTimer: 0,
        attackDuration: 0.3,
        attackCooldown: 0.5,
        attackCooldownTimer: 0,
        boundingBox: new THREE.Box3()
    };

    function queueMove(direction) {
        if (gameState.isGameOver || gameState.isInteractionActive || state.movesQueue.length > 0) return;
        const isValid = MapManager.endsUpInValidPosition(state.position, [direction]);
        if (!isValid) return;
        state.movesQueue.push(direction);
    }

    function stepCompleted() {
        const direction = state.movesQueue.shift();
        if (direction === "forward") state.position.currentRow += 1;
        if (direction === "backward") state.position.currentRow -= 1;
        if (direction === "left") state.position.currentTile -= 1;
        if (direction === "right") state.position.currentTile += 1;
        checkForInteraction();
    }
    
    function attack() {
        if (state.attackCooldownTimer > 0 || gameState.isGameOver) return;
        
        state.isAttacking = true;
        state.attackTimer = state.attackDuration;
        state.attackCooldownTimer = state.attackCooldown;

        const monsters = MapManager.getMonsters();
        const monsterWorldPosition = new THREE.Vector3(); 
        
        const damage = gameState.isCheatModeActive ? 9999 : state.attack;

        for (const monster of monsters) {
            if (!monster.ref) continue;
            
            monster.ref.getWorldPosition(monsterWorldPosition);
            const playerPosition = Player.object.position;
            const dx = playerPosition.x - monsterWorldPosition.x;
            const dy = playerPosition.y - monsterWorldPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CONSTANTS.PLAYER_MELEE_RANGE) {
                GameManager.damageMonster(monster, damage);
            }
        }
    }

    function interact() {
        if (gameState.isGameOver) return;
        if (gameState.currentInteraction) {
             if (gameState.currentInteraction.type === 'portal') {
                 GameManager.teleportPlayer();
             } else if (gameState.currentInteraction.type !== 'monster') {
                 GameManager.triggerInteraction(gameState.currentInteraction);
             }
        }
    }
    
    function reset() {
        state.position.currentRow = 0;
        state.position.currentTile = 0;
        state.movesQueue.length = 0;
        state.hp = state.maxHp;
        state.attack = 25;
        state.defense = 0;
        state.hasShield = false;
        state.isBlocking = false;
        state.isAttacking = false;
        state.attackTimer = 0;
        state.attackCooldownTimer = 0;
        playerGroup.position.set(0, 0, 0);
        updatePlayerStats();
    }

    function setBlocking(isBlocking) {
        if (!state.hasShield || state.isAttacking) return;
        state.isBlocking = isBlocking;
    }

    return { object: playerGroup, sword: swordGroup, shield: shieldMesh, body, state, queueMove, stepCompleted, interact, attack, reset, setBlocking };
})();

// --- PROJECTILE MANAGER ---
const ProjectileManager = (() => {
    const projectiles = [];
    const projectileGroup = new THREE.Group();
    scene.add(projectileGroup);

    function createProjectile(startPosition, targetPosition, damage, type) {
        let geometry;
        if (type === 'slash') {
            geometry = new THREE.PlaneGeometry(25, 10);
        } else { // bullet
            geometry = new THREE.SphereGeometry(5, 8, 8);
        }
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const projectileMesh = new THREE.Mesh(geometry, material);
        
        const direction = new THREE.Vector3().subVectors(targetPosition, startPosition).normalize();
        
        projectileMesh.position.copy(startPosition);

        const projData = {
            ref: projectileMesh,
            direction: direction,
            life: 2,
            speed: 150,
            damage: damage,
            boundingBox: new THREE.Box3()
        };
        
        projectiles.push(projData);
        projectileGroup.add(projectileMesh);
    }

    function update(delta) {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            proj.life -= delta;
            
            proj.ref.position.add(proj.direction.clone().multiplyScalar(proj.speed * delta));

            if (proj.life <= 0) {
                projectileGroup.remove(proj.ref);
                projectiles.splice(i, 1);
                continue;
            }
            
            proj.boundingBox.setFromObject(proj.ref);
            if (Player.state.boundingBox.intersectsBox(proj.boundingBox)) {
                GameManager.damagePlayer(proj.damage);
                projectileGroup.remove(proj.ref);
                projectiles.splice(i, 1);
            }
        }
    }
    
    function clearAll() {
         for (let i = projectiles.length - 1; i >= 0; i--) {
             projectileGroup.remove(projectiles[i].ref);
         }
         projectiles.length = 0;
    }

    return { createProjectile, update, clearAll };
})();

// --- TELEPORT EFFECT MODULE (MODIFIED) ---
const TeleportEffect = (() => {
    let effectGroup, pillar, ring, particles = [], pillarTexture, ringTexture;

    function generateTexture(type) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;

        if (type === 'pillar') {
            // This texture scrolls vertically on the pillar
            const gradient = ctx.createLinearGradient(0, 0, 0, 128);
            gradient.addColorStop(0, 'rgba(0, 126, 255, 0)');
            gradient.addColorStop(0.5, 'rgba(173, 216, 230, 1)'); // Light blue
            gradient.addColorStop(1, 'rgba(0, 126, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            for (let i = 0; i < 40; i++) {
                ctx.fillRect(Math.random() * 128, 0, Math.random() * 2, 128);
            }
        } else if (type === 'ring') {
            // A radial gradient for the glowing ring
            const gradient = ctx.createRadialGradient(64, 64, 50, 64, 64, 64);
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.8, 'rgba(255,255,255,1)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);
        } else if (type === 'particle') {
            // A simple dot for particles
            const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.2, 'rgba(173, 216, 230, 1)'); // Light blue
            gradient.addColorStop(0.4, 'rgba(0, 126, 255, 0.5)');
            gradient.addColorStop(1, 'rgba(0, 126, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    function create() {
        effectGroup = new THREE.Group();

        // 1. Ground Ring (on the XY plane, Z is up)
        ringTexture = generateTexture('ring');
        const ringGeo = new THREE.RingGeometry(28, 30, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            map: ringTexture,
            color: 0x00aaff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = 1; // Position slightly above the ground
        effectGroup.add(ring);

        // 2. Pillar of Light (vertical along the Z axis)
        pillarTexture = generateTexture('pillar');
        pillarTexture.wrapS = pillarTexture.wrapT = THREE.RepeatWrapping;
        const pillarGeo = new THREE.CylinderGeometry(25, 25, 200, 32, 1, true);
        const pillarMat = new THREE.MeshBasicMaterial({
            map: pillarTexture,
            color: 0x007eff,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.rotation.x = Math.PI / 2; // Rotate to be vertical
        pillar.position.z = 100; // Center the pillar vertically
        effectGroup.add(pillar);

        // 3. Particles (rising vertically along Z)
        particles = [];
        const particleTexture = generateTexture('particle');
        const particleMat = new THREE.SpriteMaterial({
            map: particleTexture,
            color: 0x87cefa,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.9
        });

        for (let i = 0; i < 80; i++) {
            const sprite = new THREE.Sprite(particleMat.clone());
            resetParticle(sprite);
            particles.push(sprite);
            effectGroup.add(sprite);
        }

        return {
            group: effectGroup,
            update: update
        };
    }

    function resetParticle(p) {
        const radius = Math.random() * 25;
        const angle = Math.random() * Math.PI * 2;
        p.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            Math.random() * 5
        );
        const scale = Math.random() * 3 + 2;
        p.scale.set(scale, scale, scale);
        p.material.opacity = Math.random() * 0.5 + 0.5;
        p.userData.velocity = new THREE.Vector3(0, 0, Math.random() * 50 + 30);
    }

    function update(delta) {
        if (!effectGroup) return;
        
        const pulse = Math.sin(clock.getElapsedTime() * 4) * 0.1 + 0.95;
        ring.scale.set(pulse, pulse, 1);
        ring.rotation.z -= delta * 0.5;
        
        pillarTexture.offset.y -= delta * 1.5;

        particles.forEach(p => {
            p.position.z += p.userData.velocity.z * delta;
            p.material.opacity -= delta * 0.7;

            if (p.material.opacity <= 0 || p.position.z > 200) {
                resetParticle(p);
            }
        });
    }
    
    function clear() {
        if (effectGroup) {
            scene.remove(effectGroup);
            effectGroup.traverse(child => {
                if (child.isMesh || child.isSprite) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            });
            effectGroup = null;
        }
        particles = [];
    }

    return { create, clear };
})();
        
// --- MAP MANAGER MODULE ---
const MapManager = (() => {
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);
    
    let mapData = [];
    let monsterList = [];

    // メインマップのNPCや宝箱、メッセージなどを日本語に
    const mainMapMetadata = [
        { type: "grass" },
        { type: "grass", objects: [{ type: "npc", tileIndex: 3, name: "老人", message: "Eキーで剣を振れるぞ！モンスターに近づきすぎると反撃されるから注意じゃ。" }] },
        { type: "path", objects: [{ type: "house", tileIndex: -5 }, { type: "house", tileIndex: 5 }] },
        { type: "path", objects: [{ type: "house", tileIndex: -5 }, { type: "npc", tileIndex: 0, name: "村人", message: "森の中で光る宝箱を見たよ！" }, { type: "house", tileIndex: 5 }] },
        { type: "grass", objects: [
            { type: "attackUp", tileIndex: -2, content: "攻撃力が5上がった！", value: 5 },
            { type: "defenseUp", tileIndex: 2, content: "防御力が5上がった！", value: 5 },
            // ★宝箱追加（回復ポーション）
            { type: "treasure", tileIndex: 5, content: "ポーションを見つけた！（HP全回復）", itemType: "potion" }
        ] },
        { type: "grass", objects: [
            { type: "tree", tileIndex: -8 }, { type: "tree", tileIndex: 8 },
            // ★宝箱修正（ミスリルアーマー）
            { type: "treasure", tileIndex: 0, content: "ミスリルアーマーを手に入れた！（防御力+40）", itemType: "mythrilArmor" }
        ] },
        { type: "grass", objects: [{ type: "tree", tileIndex: -6 }, { type: "tree", tileIndex: 0 }, { type: "tree", tileIndex: 6 }, { type: "monster", tileIndex: 3, name: "スライム", hp: 50, maxHp: 50, attack: 5, attackRange: 100, attackCooldown: 0.2, attackType: 'slash' }] },
        { type: "grass", objects: [{ type: "tree", tileIndex: -3 }, { type: "tree", tileIndex: 4 }, { type: "monster", tileIndex: -5, name: "スライム", hp: 50, maxHp: 50, attack: 5, attackRange: 100, attackCooldown: 0.2, attackType: 'slash' }] },
        { type: "grass", objects: [
            { type: "tree", tileIndex: -8 }, { type: "treasure", tileIndex: 0, content: "エリクサーを見つけた！（HP全回復＆攻撃+5）", itemType: "elixir" }, { type: "tree", tileIndex: 8 }
        ] },
        { type: "grass", objects: [{ type: "tree", tileIndex: -6 }, { type: "tree", tileIndex: -1 }, { type: "tree", tileIndex: 5 }, { type: "monster", tileIndex: 2, name: "ゴブリン", hp: 70, maxHp: 70, attack: 10, attackRange: 110, attackCooldown: 0.15, attackType: 'slash' }] },
        // ★宝箱追加（回復ポーション）
        { type: "swamp", objects: [
            { type: "tree", tileIndex: -10, isDead: true }, { type: "tree", tileIndex: 10, isDead: true },
            { type: "treasure", tileIndex: 0, content: "ポーションを見つけた！（HP全回復）", itemType: "potion" }
        ] },
        { type: "swamp", objects: [{ type: "monster", tileIndex: -4, name: "スペクター", hp: 80, maxHp: 80, attack: 15, attackRange: 130, attackCooldown: 0.25, attackType: 'bullet' }, { type: "tree", tileIndex: 3, isDead: true }, { type: "monster", tileIndex: 8, name: "スペクター", hp: 80, maxHp: 80, attack: 15, attackRange: 130, attackCooldown: 0.25, attackType: 'bullet' }] },
        { type: "swamp", objects: [{ type: "tree", tileIndex: -7, isDead: true }, { type: "npc", tileIndex: 0, name: "隠者", message: "砂漠の奥には古代の力と大きな危険が眠っている…。" }, { type: "tree", tileIndex: 7, isDead: true }] },
        { type: "swamp", objects: [{ type: "monster", tileIndex: -2, name: "スペクター", hp: 80, maxHp: 80, attack: 15, attackRange: 130, attackCooldown: 0.25, attackType: 'bullet' }, { type: "monster", tileIndex: 5, name: "スペクター", hp: 80, maxHp: 80, attack: 15, attackRange: 130, attackCooldown: 0.25, attackType: 'bullet' }] },
        { type: "desert", objects: [{ type: "cactus", tileIndex: -9 }, { type: "cactus", tileIndex: 9 }] },
        { type: "desert", objects: [{ type: "cactus", tileIndex: -5 }, { type: "monster", tileIndex: 2, name: "サンドワーム", hp: 120, maxHp: 120, attack: 20, attackRange: 140, attackCooldown: 0.3, attackType: 'bullet' }, { type: "cactus", tileIndex: 7 }] },
        { type: "desert", objects: [{ type: "npc", tileIndex: 0, name: "オアシスの精霊", message: "ここまでよく来ました。最後の試練は灼熱の地にあります。" }, { type: "treasure", tileIndex: 8, content: "サンストーンを手に入れた！（攻撃力+10）" }] },
        { type: "desert", objects: [{ type: "cactus", tileIndex: -11 }, { type: "monster", tileIndex: -3, name: "サンドワーム", hp: 120, maxHp: 120, attack: 20, attackRange: 140, attackCooldown: 0.3, attackType: 'bullet' }, { type: "cactus", tileIndex: 4 }, { type: "monster", tileIndex: 10, name: "サンドワーム", hp: 120, maxHp: 120, attack: 20, attackRange: 140, attackCooldown: 0.3, attackType: 'bullet' }] },
        { type: "desert", objects: [{ type: "cactus", tileIndex: -8 }, { type: "cactus", tileIndex: 0 }, { type: "cactus", tileIndex: 8 }] },
        { type: "rock", objects: [{ type: "monster", tileIndex: -4, name: "ゴブリン", hp: 70, maxHp: 70, attack: 10, attackRange: 110, attackCooldown: 0.15, attackType: 'slash' }, { type: "monster", tileIndex: 4, name: "ゴブリン", hp: 70, maxHp: 70, attack: 10, attackRange: 110, attackCooldown: 0.15, attackType: 'slash' }] },
        { type: "burnt_rock" },
        { type: "burnt_rock", objects: [{ type: "monster", tileIndex: 0, name: "ドラゴン", hp: 300, maxHp: 300, attack: 35, attackRange: 180, attackCooldown: 0.4, attackType: 'bullet', isBoss: true }] },
    ];
    // ボスエリアのテキストも日本語化
    const bossMapMetadata = [
        { type: "boss_arena" },
        { type: "boss_arena" },
        { type: "boss_arena" },
        { type: "boss_arena" },
        // 中央に配置
        { type: "boss_arena", objects: [{ type: "monster", tileIndex: 0, name: "アークデーモン", hp: 666, maxHp: 666, attack: 50, attackRange: 250, attackCooldown: 0.5, attackType: 'bullet', isFinalBoss: true }] },
        { type: "boss_arena" },
        { type: "boss_arena" },
        { type: "boss_arena" },
        { type: "boss_arena" },
        { type: "boss_arena" },
    ];

    function removeObjectFromMap(objectToRemove) {
        for (const row of mapData) {
            const objectIndex = row.objects.findIndex(obj => obj === objectToRemove);
            if (objectIndex !== -1) {
                row.objects.splice(objectIndex, 1);
                if (objectToRemove.type === 'monster') {
                    const monsterIndex = monsterList.findIndex(m => m === objectToRemove);
                    if (monsterIndex !== -1) monsterList.splice(monsterIndex, 1);
                }
                if (objectToRemove.ref) objectToRemove.ref.removeFromParent();
                break;
            }
        }
    }

    function createGround(rowIndex, color) {
        const ground = new THREE.Group();
        ground.position.y = rowIndex * CONSTANTS.tileSize;
        const foundation = new THREE.Mesh(new THREE.BoxGeometry(CONSTANTS.tilesPerRow * CONSTANTS.tileSize, CONSTANTS.tileSize, 4), new THREE.MeshLambertMaterial({ color }));
        foundation.position.z = -2;
        ground.add(foundation);
        return ground;
    }
    
    function createMonster(tileIndex, name) {
        const monsterGroup = new THREE.Group();
        let color, size, geometry;
        if (name === "アークデーモン") {
            // gankyuu.glbを読み込んで配置
            gltfLoader.load('./images/gankyuu.glb', (gltf) => {
                const model = gltf.scene;
                model.position.set(0, 0, 80); // より高く表示
                model.rotation.y = Math.PI; // Y軸180度回転
                model.rotation.x = Math.PI / 2; // X軸90度回転（横向き）
                model.scale.set(20, 20, 20); // 必要に応じてスケール調整
                monsterGroup.add(model);
            });
            color = 0x4b0082; size = 50; geometry = new THREE.SphereGeometry(size, 16, 16); // 予備の当たり判定用
        } else {
            switch(name) {
                case "スライム": color = 0xadd8e6; size = 18; geometry = new THREE.SphereGeometry(size, 8, 8); break;
                case "ゴブリン": color = 0x90ee90; size = 18; geometry = new THREE.SphereGeometry(size, 8, 8); break;
                case "スペクター": color = 0xe6e6fa; size = 20; geometry = new THREE.ConeGeometry(size, size * 2, 8); break;
                case "サンドワーム": color = 0xf0e68c; size = 22; geometry = new THREE.CylinderGeometry(size / 2, size, size * 1.5, 8); break;
                case "ドラゴン": color = 0xdc143c; size = 40; geometry = new THREE.SphereGeometry(size, 8, 8); break;
                default: color = 0xffffff; size = 15; geometry = new THREE.SphereGeometry(size, 8, 8);
            }
            const monsterMesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
            monsterMesh.position.z = size;
            monsterGroup.add(monsterMesh);
        }
        const hpBarWidth = 30;
        const hpBarHeight = 4;
        const hpBarGroup = new THREE.Group();
        const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        const hpBarGeo = new THREE.PlaneGeometry(hpBarWidth, hpBarHeight);
        const hpBarMesh = new THREE.Mesh(hpBarGeo, hpBarMat);
        hpBarGroup.add(hpBarMesh);
        hpBarGroup.position.z = size * 2 + 10;
        hpBarGroup.rotation.x = -Math.PI / 2;
        hpBarGroup.visible = false;
        monsterGroup.add(hpBarGroup);
        monsterGroup.position.x = tileIndex * CONSTANTS.tileSize;
        monsterGroup.userData = { hpBarGroup, hpBarMesh, hpBarWidth, originalColor: color, maxHp: 100 };
        return monsterGroup;
    }

    function addPortal(rowIndex, tileIndex) {
        gameState.activeTeleportEffect = TeleportEffect.create();
        const portalPosition = new THREE.Vector3(tileIndex * CONSTANTS.tileSize, rowIndex * CONSTANTS.tileSize, 0);
        gameState.activeTeleportEffect.group.position.copy(portalPosition);
        scene.add(gameState.activeTeleportEffect.group);

        const portalData = {
            type: 'portal',
            tileIndex: tileIndex,
            rowIndex: rowIndex,
        };
        mapData[rowIndex].objects.push(portalData);
        GameManager.showMessage("不思議なポータルが現れた！");
        setTimeout(GameManager.hideMessage, 2000);
    }

    function generateMap(mapDefinition) {
        while(mapGroup.children.length > 0){ 
            mapGroup.remove(mapGroup.children[0]); 
        }
        mapData = [];
        monsterList = [];

        mapDefinition.forEach((rowData, rowIndex) => {
            const row = createGround(rowIndex, getGroundColor(rowData.type));
            row.userData.rowIndex = rowIndex;
            const mapRow = { rowIndex, ref: row, objects: [] };

            if (rowData.objects) {
                rowData.objects.forEach(objData => {
                    let obj3D;
                    const newObjData = JSON.parse(JSON.stringify(objData));
                    
                    switch(newObjData.type) {
                        case 'tree': obj3D = createTree(newObjData.tileIndex, newObjData.isDead); break;
                        case 'cactus': obj3D = createCactus(newObjData.tileIndex); break;
                        case 'house': obj3D = createHouse(newObjData.tileIndex); break;
                        case 'npc': obj3D = createNPC(newObjData.tileIndex); break;
                        case 'monster': 
                            obj3D = createMonster(newObjData.tileIndex, newObjData.name);
                            Object.assign(newObjData, {
                                boundingBox: new THREE.Box3(),
                                attackCooldownTimer: 1.5,
                                rowIndex: rowIndex,
                                ...obj3D.userData
                            });
                            break;
                        case 'treasure': obj3D = createTreasureChest(newObjData.tileIndex); break;
                        case 'attackUp': obj3D = createAttackUpItem(newObjData.tileIndex); break;
                        case 'defenseUp': obj3D = createDefenseUpItem(newObjData.tileIndex); break;
                    }

                    if (obj3D) {
                        row.add(obj3D);
                        newObjData.ref = obj3D;
                        mapRow.objects.push(newObjData);

                        if (newObjData.type === 'monster') {
                            monsterList.push(newObjData);
                        }
                    }
                });
            }
            mapGroup.add(row);
            mapData.push(mapRow);
        });
    }
    
    function getGroundColor(type) {
        switch(type) {
            case 'grass': return 0x98fb98;
            case 'path': return 0xf4a460;
            case 'rock': return 0x808080;
            case 'swamp': return 0x556b2f;
            case 'desert': return 0xf5deb3;
            case 'burnt_rock': return 0x36454f;
            case 'boss_arena': return 0x1a001a;
            default: return 0x98fb98;
        }
    }

    function getObjectAt(row, tile) {
        if (row < 0 || row >= mapData.length) return null;
        const rowData = mapData[row];
        return rowData.objects.find(obj => obj.tileIndex === tile);
    }

    function endsUpInValidPosition(currentPosition, moves) {
        const finalPosition = calculateFinalPosition(currentPosition, moves);
        if (finalPosition.currentRow < 0 || finalPosition.currentRow >= mapData.length ||
            finalPosition.currentTile < CONSTANTS.minTileIndex ||
            finalPosition.currentTile > CONSTANTS.maxTileIndex) {
            return false;
        }
        const objectAtTarget = getObjectAt(finalPosition.currentRow, finalPosition.currentTile);
        if (objectAtTarget && ['tree', 'house', 'cactus', 'monster'].includes(objectAtTarget.type)) {
            return false;
        }
        return true;
    }
    
    const calculateFinalPosition = (pos, moves) => moves.reduce((p, d) => ({
        currentRow: p.currentRow + (d === "forward" ? 1 : (d === "backward" ? -1 : 0)),
        currentTile: p.currentTile + (d === "left" ? -1 : (d === "right" ? 1 : 0)),
    }), pos);
    
    const createTree = (tileIndex, isDead) => { const t = new THREE.Group(); t.position.x = tileIndex * CONSTANTS.tileSize; const tc = isDead ? 0x5d4037 : 0x8b4513; const cc = isDead ? 0x8d6e63 : 0x228b22; const cg = isDead ? new THREE.BoxGeometry(20, 20, 30) : new THREE.BoxGeometry(35, 35, 40); const tr = new THREE.Mesh(new THREE.BoxGeometry(15, 15, 20), new THREE.MeshLambertMaterial({ color: tc })); tr.position.z = 10; t.add(tr); const cr = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: cc })); cr.position.z = isDead ? 30 : 40; t.add(cr); return t; };
    const createCactus = (tileIndex) => { const c = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 40), new THREE.MeshLambertMaterial({ color: 0x556b2f })); c.position.x = tileIndex * CONSTANTS.tileSize; c.position.z = 20; return c; };
    const createHouse = (tileIndex) => { const h = new THREE.Group(); h.position.x = tileIndex * CONSTANTS.tileSize; const b = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 30), new THREE.MeshLambertMaterial({ color: 0xd2b48c })); b.position.z = 15; h.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(35, 20, 4), new THREE.MeshLambertMaterial({ color: 0xa0522d })); r.position.z = 40; r.rotation.y = Math.PI / 4; h.add(r); return h; };
    const createNPC = (tileIndex) => { const n = new THREE.Mesh(new THREE.BoxGeometry(15, 15, 25), new THREE.MeshLambertMaterial({ color: 0xffa07a })); n.position.x = tileIndex * CONSTANTS.tileSize; n.position.z = 12.5; return n; };
    const createTreasureChest = (tileIndex) => { const c = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshLambertMaterial({ color: 0xdaa520 })); c.position.x = tileIndex * CONSTANTS.tileSize; c.position.z = 10; return c; };

    const createAttackUpItem = (tileIndex) => {
        const i = new THREE.Group();
        i.position.x = tileIndex * CONSTANTS.tileSize;

        // 柄 (Hilt)
        const hilt = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 10), new THREE.MeshLambertMaterial({ color: 0x654321 }));
        hilt.position.z = 5; // 柄の高さの半分
        i.add(hilt);

        // 鍔 (Crossguard)
        const crossguard = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 2), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
        crossguard.position.z = 10 + 1; // 柄の高さ + 鍔の高さの半分
        i.add(crossguard);

        // 刀身 (Blade)
        const blade = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 25), new THREE.MeshLambertMaterial({ color: 0xc0c0c0 }));
        blade.position.z = 10 + 2 + 12.5; // 柄の高さ + 鍔の高さ + 刀身の高さの半分
        i.add(blade);

        i.rotation.z = Math.PI / 4; // 傾きを維持
        i.scale.set(0.8, 0.8, 0.8); // スケールを維持
        return i;
    };
    const createDefenseUpItem = (tileIndex) => { const s = new THREE.Mesh(new THREE.BoxGeometry(25, 5, 35), new THREE.MeshLambertMaterial({ color: 0x8B4513 })); s.position.x = tileIndex * CONSTANTS.tileSize; s.position.z = 17.5; s.rotation.x = Math.PI / 5; return s; };

    generateMap(mainMapMetadata);

    return { getMonsters: () => monsterList, endsUpInValidPosition, getObjectAt, removeObjectFromMap, generateMap, addPortal, mainMapMetadata, bossMapMetadata };
})();

// --- GAME MANAGER ---
const GameManager = (() => {
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);

    function setupLights() {
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        dirLight.position.set(-150, -200, 300);
        scene.add(dirLight);
    }
    setupLights();

    function triggerInteraction(interaction) {
        const { type, name, message, content, itemType } = interaction;
        switch(type) {
            case 'npc': showMessage(`${name}: "${message}"`); break;
            case 'treasure':
                if (interaction.isOpened) { showMessage("宝箱は空っぽだった。"); } 
                else {
                    showMessage(content || "宝箱を開けた！");
                    interaction.isOpened = true; 
                    // ★新しい宝箱アイテムの効果
                    if (itemType === "potion") {
                        Player.state.hp = Player.state.maxHp;
                    } else if (itemType === "mythrilArmor") {
                        Player.state.defense += 40;
                    } else if (itemType === "elixir") {
                        Player.state.hp = Player.state.maxHp;
                        Player.state.attack += 5;
                    } else {
                        if (content.includes("Potion") || content.includes("ポーション")) Player.state.hp = Player.state.maxHp;
                        if (content.includes("Sunstone") || content.includes("サンストーン")) Player.state.attack += 10;
                    }
                    updatePlayerStats();
                }
                break;
            case 'attackUp':
                showMessage(content || "攻撃力が上がった！");
                Player.state.attack += interaction.value || 5;
                MapManager.removeObjectFromMap(interaction);
                updatePlayerStats();
                setTimeout(hideMessage, 1500);
                break;
            case 'defenseUp':
                if (Player.state.hasShield) {
                    showMessage("既に盾を装備している。");
                } else {
                    showMessage("盾を装備した！ Fキーで防御できる。");
                    Player.state.hasShield = true;
                    Player.shield.visible = true;
                    Player.state.defense += 5; // 盾による基礎防御力
                    MapManager.removeObjectFromMap(interaction);
                    updatePlayerStats();
                }
                setTimeout(hideMessage, 2000);
                break;
        }
    }
    
    function damageMonster(monster, damage) {
        if(monster.hp <= 0) return;
        monster.hp -= damage;
        if (monster.hp < 0) monster.hp = 0;

        if (!monster.hpBarGroup.visible) {
            monster.hpBarGroup.visible = true;
        }
        const hpPercent = monster.hp / monster.maxHp;
        monster.hpBarMesh.scale.x = hpPercent;
        monster.hpBarMesh.position.x = - (1 - hpPercent) * (monster.hpBarWidth / 2);
        let color;
        if (monster.hp === monster.maxHp) {
            color = new THREE.Color(0x00ff00);
        } else {
            color = new THREE.Color(0xff0000);
        }
        monster.hpBarMesh.material.color.copy(color);

        if (monster.ref.children[0] && monster.ref.children[0].isMesh) {
            monster.ref.children[0].material.color.set(0xff0000);
            setTimeout(() => {
                if (monster.ref && monster.ref.children[0]) {
                    monster.ref.children[0].material.color.set(monster.originalColor);
                }
            }, 150);
        }

        // ★ラスボスHPバー更新
        if (monster.isFinalBoss) {
            bossHpUI.update(monster.hp, monster.maxHp);
        }

        if (monster.hp <= 0) {
            if (monster.isFinalBoss) {
                showMessage("おめでとう！アークデーモンを倒した！");
                setTimeout(() => endGame(true), 3000);
                // ★ラスボス撃破でHPバー非表示
                bossHpUI.hide();
            } else {
                 showMessage(`${monster.name}を倒した！`);
            }
            if (monster.isBoss) {
                MapManager.addPortal(monster.rowIndex, monster.tileIndex);
            }
            MapManager.removeObjectFromMap(monster);
            gameState.currentInteraction = null;
            checkForInteraction();
            if (!monster.isBoss) {
                setTimeout(hideMessage, 1500);
            }
        }
    }

    function damagePlayer(damage) {
        // ★無敵中はダメージ無効
        if (gameState.isCheatModeActive || gameState.isInvincible) return;

        let finalDamage = damage;
        if (Player.state.isBlocking) {
            finalDamage *= 0.2; // 防御中は80%ダメージカット
        }

        finalDamage -= Player.state.defense;

        // ダメージが0以上の場合、最低でも1ダメージは保証する
        const actualDamage = damage > 0 ? Math.max(1, Math.floor(finalDamage)) : 0;

        Player.state.hp -= actualDamage;
        if (Player.state.hp < 0) Player.state.hp = 0;
        if (Player.state.hp < 0) Player.state.hp = 0;
        updatePlayerStats();
        
        document.body.style.backgroundColor = '#8b0000';
        setTimeout(() => {
            if (scene.background === null) {
               document.body.style.backgroundColor = '#3a2d3e';
            }
        }, 150);

        if (Player.state.hp <= 0) endGame(false);
        // プレイヤーが攻撃を受けてもセリフは表示しない（showMessageやhideMessageを呼ばない）
    }

    function showMessage(text) {
        messageText.textContent = text;
        uiContainer.style.display = 'flex';
        gameState.isInteractionActive = true;
    }

    function hideMessage() {
        uiContainer.style.display = 'none';
        gameState.isInteractionActive = false;
    }

    function teleportPlayer() {
        const portal = gameState.currentInteraction;
        if (!portal || portal.type !== 'portal' || gameState.hasTeleportedToBoss) return;

        const fadeOverlay = document.getElementById('fade-overlay');
        fadeOverlay.style.opacity = "1";

        setTimeout(() => {
            MapManager.removeObjectFromMap(portal);
            if (gameState.activeTeleportEffect) {
                TeleportEffect.clear();
                gameState.activeTeleportEffect = null;
            }
            gameState.hasTeleportedToBoss = true;

            MapManager.generateMap(MapManager.bossMapMetadata);
            Player.reset();
            ProjectileManager.clearAll();

            scene.background = new THREE.Color(0x1a001a);
            dirLight.intensity = 0.4;

            // ★無敵時間開始
            gameState.isInvincible = true;
            setTimeout(() => { gameState.isInvincible = false; }, 3000);

            // ★ラスボスHPバー表示
            const boss = MapManager.getMonsters().find(m => m.isFinalBoss);
            if (boss) bossHpUI.show(boss.name, boss.hp, boss.maxHp);

            showMessage("最終決戦の場に転送された！");
            setTimeout(() => {
                fadeOverlay.style.opacity = "0";
                setTimeout(hideMessage, 2000);
            }, 500);

        }, 500);
    }

    function toggleCheatMode() {
        gameState.isCheatModeActive = !gameState.isCheatModeActive;
        const infoPanel = document.getElementById('info-panel');
        if (gameState.isCheatModeActive) {
            showMessage("チートモードON：無敵＆一撃必殺！");
            infoPanel.style.boxShadow = "0 0 15px 5px #ff00ff";
        } else {
            showMessage("チートモードOFF");
            infoPanel.style.boxShadow = "none";
        }
        setTimeout(hideMessage, 2000);
    }

    function restartGame() {
        gameState.isGameOver = false;
        gameState.isInteractionActive = false;
        gameState.currentInteraction = null;
        gameState.gameStarted = false;
        gameState.isCheatModeActive = false;
        gameState.hasTeleportedToBoss = false;
        gameState.isInvincible = false; // ★リスタート時に無敵解除
        document.getElementById('info-panel').style.boxShadow = "none";
        
        if (gameState.activeTeleportEffect) {
            TeleportEffect.clear();
            gameState.activeTeleportEffect = null;
        }

        document.getElementById('game-over-modal').style.display = 'none';

        scene.background = null;
        dirLight.intensity = 0.9;

        MapManager.generateMap(MapManager.mainMapMetadata);
        Player.reset();
        ProjectileManager.clearAll();

        clock.stop();
        clock.start();

        renderer.setAnimationLoop(animate);

        // ★リスタート時にHPバー非表示
        bossHpUI.hide();
    }

    return { triggerInteraction, damageMonster, damagePlayer, showMessage, hideMessage, restartGame, teleportPlayer, toggleCheatMode };
})();

// --- CAMERA & RENDERER ---
const camera = (() => {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 350;
    const cam = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 100, 2000);
    cam.position.set(200, -200, 200);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, 0, 0);
    return cam;
})();
Player.object.add(camera);

const renderer = (() => {
    const rend = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), alpha: true, antialias: true });
    rend.setPixelRatio(window.devicePixelRatio);
    rend.setSize(window.innerWidth, window.innerHeight);
    return rend;
})();

// --- ANIMATION & GAME LOGIC ---
const moveClock = new THREE.Clock(false);
const monsterWorldPosition = new THREE.Vector3();
const playerWorldPosition = new THREE.Vector3();

// --- ラスボスHPバー管理 ---
const bossHpUI = {
    container: document.getElementById('boss-hp-container') as HTMLDivElement,
    name: document.getElementById('boss-name') as HTMLDivElement,
    bar: document.getElementById('boss-hp-bar') as HTMLDivElement,
    value: document.getElementById('boss-hp-value') as HTMLDivElement,
    show(name: string, hp: number, maxHp: number) {
        this.container.style.display = 'block';
        this.name.textContent = name;
        this.update(hp, maxHp);
    },
    update(hp: number, maxHp: number) {
        const percent = Math.max(0, Math.min(1, hp / maxHp));
        this.bar.style.width = `${percent * 100}%`;
        this.value.textContent = `${Math.ceil(hp)} / ${maxHp}`;
    },
    hide() {
        this.container.style.display = 'none';
    }
};

// --- ラスボス用ビーム攻撃エフェクト管理 ---
const BossBeamAttackManager = (() => {
    let warningCircles = [];
    let beams = [];
    const BEAM_RADIUS = 50;
    const CHARGE_DURATION = 1.5;
    const FIRE_DURATION = 0.2;
    const IMPACT_DURATION = 0.8;
    return {
        addWarningCircle: (pos, radius, duration) => {
            // 予兆円は従来通り
            const geo = new THREE.RingGeometry(radius * 0.8, radius, 48);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            mesh.position.z = 2;
            mesh.rotation.x = -Math.PI / 2;
            scene.add(mesh);
            warningCircles.push({ mesh, timer: duration });
            return mesh;
        },
        addBeam: (pos, radius, height, totalDuration) => {
            // 予兆円
            const circleGeo = new THREE.RingGeometry(radius * 0.92, radius, 64);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending });
            const chargeCircle = new THREE.Mesh(circleGeo, circleMat);
            chargeCircle.rotation.x = 0;
            chargeCircle.rotation.z = Math.PI / 2; // 横向き
            chargeCircle.position.copy(pos);
            chargeCircle.position.z = 0.1;
            chargeCircle.scale.set(0.01, 0.01, 0.01);
            chargeCircle.material.opacity = 1.0;
            scene.add(chargeCircle);

            // ビーム
            const beamGeo = new THREE.CylinderGeometry(radius * 0.4, radius * 0.5, height, 32, 1, true);
            const beamMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.copy(pos);
            beam.position.z = height / 2;
            beam.visible = false;
            // ここでビームの向きを地面と垂直にする
            beam.rotation.x = -Math.PI / 2;
            scene.add(beam);

            // 衝撃波
            const waveGeo = new THREE.TorusGeometry(radius, 2.5, 16, 64);
            const waveMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, blending: THREE.AdditiveBlending });
            const impactWave = new THREE.Mesh(waveGeo, waveMat);
            impactWave.rotation.x = 0;
            impactWave.rotation.z = Math.PI / 2; // 横向き
            impactWave.position.copy(pos);
            impactWave.position.z = 0.2;
            impactWave.visible = false;
            scene.add(impactWave);

            beams.push({
                state: 'charging',
                timer: 0,
                pos,
                radius,
                height,
                chargeCircle,
                beam,
                impactWave,
                hasDamaged: false
            });
        },
        update: (delta) => {
            // 予兆サークルの従来の管理
            for (let i = warningCircles.length - 1; i >= 0; i--) {
                warningCircles[i].timer -= delta;
                if (warningCircles[i].timer <= 0) {
                    scene.remove(warningCircles[i].mesh);
                    warningCircles[i].mesh.geometry.dispose();
                    warningCircles[i].mesh.material.dispose();
                    warningCircles.splice(i, 1);
                }
            }
            // ビームアニメーション管理
            for (let i = beams.length - 1; i >= 0; i--) {
                const b = beams[i];
                b.timer += delta;
                if (b.state === 'charging') {
                    // 予兆円拡大・フェード
                    let progress = Math.min(b.timer / CHARGE_DURATION, 1.0);
                    let scale = progress * progress;
                    b.chargeCircle.scale.set(scale, scale, scale);
                    b.chargeCircle.material.opacity = 0.8 * (1 - progress);
                    if (b.timer >= CHARGE_DURATION) {
                        b.state = 'firing';
                        b.timer = 0;
                        b.chargeCircle.visible = false;
                        b.beam.visible = true;
                        b.beam.scale.set(1, 0.01, 1);
                        b.beam.material.opacity = 0.8;
                        b.beam.position.z = b.height / 2;
                    }
                } else if (b.state === 'firing') {
                    // ビームが上から下に伸びる
                    let fireProgress = Math.min(b.timer / FIRE_DURATION, 1.0);
                    b.beam.scale.y = fireProgress;
                    b.beam.position.z = b.height / 2 - (b.height / 2) * fireProgress;
                    if (b.timer >= FIRE_DURATION) {
                        b.state = 'impact';
                        b.timer = 0;
                        b.impactWave.visible = true;
                        b.impactWave.scale.set(0.1, 0.1, 0.1);
                        b.impactWave.material.opacity = 1.0;
                        // ダメージ判定（impact時のみ1回）
                        if (!b.hasDamaged) {
                            const dx = Player.object.position.x - b.pos.x;
                            const dy = Player.object.position.y - b.pos.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < b.radius) {
                                GameManager.damagePlayer(100);
                                // showMessageやhideMessageは呼ばない
                                // GameManager.showMessage('アークデーモンのビーム攻撃！');
                                // setTimeout(GameManager.hideMessage, 1200);
                            }
                            b.hasDamaged = true;
                        }
                    }
                } else if (b.state === 'impact') {
                    // 衝撃波が広がり、ビームが消える
                    let impactProgress = Math.min(b.timer / IMPACT_DURATION, 1.0);
                    b.beam.material.opacity = 1.0 - impactProgress;
                    b.impactWave.scale.set(impactProgress * 2.0, impactProgress * 2.0, impactProgress * 2.0);
                    b.impactWave.material.opacity = 1.0 - impactProgress * impactProgress;
                    if (b.timer >= IMPACT_DURATION) {
                        // 片付け
                        scene.remove(b.chargeCircle);
                        scene.remove(b.beam);
                        scene.remove(b.impactWave);
                        b.chargeCircle.geometry.dispose();
                        b.chargeCircle.material.dispose();
                        b.beam.geometry.dispose();
                        b.beam.material.dispose();
                        b.impactWave.geometry.dispose();
                        b.impactWave.material.dispose();
                        beams.splice(i, 1);
                    }
                }
            }
        },
        clearAll: () => {
            warningCircles.forEach(w => { scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); });
            beams.forEach(b => {
                scene.remove(b.chargeCircle); b.chargeCircle.geometry.dispose(); b.chargeCircle.material.dispose();
                scene.remove(b.beam); b.beam.geometry.dispose(); b.beam.material.dispose();
                scene.remove(b.impactWave); b.impactWave.geometry.dispose(); b.impactWave.material.dispose();
            });
            warningCircles = [];
            beams = [];
        }
    };
})();

function updateMonsters(delta) {
    if (!gameState.gameStarted) return;
    const monsters = MapManager.getMonsters();
    playerWorldPosition.copy(Player.object.position);

    for (const monster of monsters) {
        if (!monster.ref) continue;
        monster.boundingBox.setFromObject(monster.ref);
        monster.ref.position.z += Math.sin(clock.elapsedTime * 3 + monster.ref.position.x) * 0.2;
        monster.attackCooldownTimer -= delta;
        monster.ref.getWorldPosition(monsterWorldPosition);
        const distanceToPlayer = monsterWorldPosition.distanceTo(playerWorldPosition);

        // --- アークデーモン専用ビーム攻撃 ---
        if (monster.isFinalBoss) {
            if (!monster.beamAttackTimer) monster.beamAttackTimer = 0;
            if (!monster.beamAttackState) monster.beamAttackState = 'idle';
            if (!monster.beamWarningPos) monster.beamWarningPos = null;
            if (!monster.beamRadius) monster.beamRadius = 50;
            if (!monster.beamCooldown) monster.beamCooldown = 5 + Math.random() * 2;
            monster.beamAttackTimer -= delta;

            if (monster.beamAttackState === 'idle') {
                if (monster.beamAttackTimer <= 0) {
                    // プレイヤーの近くにビーム攻撃を発動
                    const px = Player.object.position.x + (Math.random() - 0.5) * 60;
                    const py = Player.object.position.y + (Math.random() - 0.5) * 60;
                    const pos = new THREE.Vector3(px, py, 0);
                    BossBeamAttackManager.addBeam(pos, monster.beamRadius, 240, 2.5); // 2.5秒で一連の演出
                    monster.beamWarningPos = pos;
                    monster.beamAttackState = 'cooldown';
                    monster.beamAttackTimer = monster.beamCooldown;
                    monster.beamCooldown = 5 + Math.random() * 2;
                }
            } else if (monster.beamAttackState === 'cooldown') {
                if (monster.beamAttackTimer <= 0) {
                    monster.beamAttackState = 'idle';
                }
            }
        }

        // 通常攻撃
        if (distanceToPlayer < monster.attackRange && monster.attackCooldownTimer <= 0) {
            const startPos = new THREE.Vector3();
            monster.ref.children[0].getWorldPosition(startPos);
            ProjectileManager.createProjectile(startPos, playerWorldPosition, monster.attack, monster.attackType);
            monster.attackCooldownTimer = monster.attackCooldown;
        }
    }
    // ビーム・予告サークルのエフェクト更新
    BossBeamAttackManager.update(delta);
}

function animatePlayer(delta) {
    if (Player.state.attackCooldownTimer > 0) Player.state.attackCooldownTimer -= delta;

    Player.state.boundingBox.setFromObject(Player.body);

    if (Player.state.movesQueue.length > 0) {
        if (!moveClock.running) moveClock.start();
        const progress = Math.min(1, moveClock.getElapsedTime() / CONSTANTS.stepTime);
        const startX = Player.state.position.currentTile * CONSTANTS.tileSize;
        const startY = Player.state.position.currentRow * CONSTANTS.tileSize;
        let endX = startX, endY = startY;
        const nextMove = Player.state.movesQueue[0];

        if (nextMove === "left") endX -= CONSTANTS.tileSize;
        if (nextMove === "right") endX += CONSTANTS.tileSize;
        if (nextMove === "forward") endY += CONSTANTS.tileSize;
        if (nextMove === "backward") endY -= CONSTANTS.tileSize;

        Player.object.position.x = THREE.MathUtils.lerp(startX, endX, progress);
        Player.object.position.y = THREE.MathUtils.lerp(startY, endY, progress);
        Player.body.position.z = Math.sin(progress * Math.PI) * 10 + 10;

        if (progress >= 1) {
            Player.stepCompleted();
            moveClock.stop();
        }
    } else {
        const targetX = Player.state.position.currentTile * CONSTANTS.tileSize;
        const targetY = Player.state.position.currentRow * CONSTANTS.tileSize;
        Player.object.position.x = targetX;
        Player.object.position.y = targetY;
    }

    if (Player.state.isAttacking) {
        Player.state.attackTimer -= delta;
        const attackProgress = 1 - (Player.state.attackTimer / Player.state.attackDuration);
        const swingAngle = Math.sin(attackProgress * Math.PI) * -Math.PI / 1.5;
        Player.sword.rotation.x = swingAngle;

        if (Player.state.attackTimer <= 0) {
            Player.state.isAttacking = false;
            Player.sword.rotation.x = 0;
        }
    }

    if (Player.state.isBlocking) {
        Player.shield.position.x = -15; // 前に突き出す
        Player.shield.rotation.y = -Math.PI / 4; // 少し傾ける
    } else if (Player.state.hasShield) {
        Player.shield.position.x = -12;
        Player.shield.rotation.y = 0;
    }
}

function updatePlayerStats() {
    hpValueText.textContent = Math.ceil(Player.state.hp).toString();
    const hpPercent = (Player.state.hp / Player.state.maxHp) * 100;
    hpBar.style.width = `${hpPercent}%`;
    hpBar.style.backgroundColor = `hsl(${(hpPercent / 100) * 120}, 70%, 50%)`;
}

function checkForInteraction() {
    const pos = Player.state.position;
    let foundInteraction = null;
    const checkPositions = [
        { r: pos.currentRow, t: pos.currentTile },
        { r: pos.currentRow + 1, t: pos.currentTile }, { r: pos.currentRow - 1, t: pos.currentTile },
        { r: pos.currentRow, t: pos.currentTile + 1 }, { r: pos.currentRow, t: pos.currentTile - 1 },
    ];
    for (const p of checkPositions) {
        const obj = MapManager.getObjectAt(p.r, p.t);
        if (obj && ['npc', 'treasure', 'portal', 'attackUp', 'defenseUp'].includes(obj.type) && !(obj.type === 'treasure' && obj.isOpened)) {
            // For portals, only allow interaction when the player is on the same tile
            if (obj.type === 'portal') {
                if (p.r === pos.currentRow && p.t === pos.currentTile) {
                   foundInteraction = obj;
                   break;
                }
            } else {
                foundInteraction = obj;
                break;
            }
        }
    }
    gameState.currentInteraction = foundInteraction;
    const infoPanel = document.getElementById('info-panel');
    if (foundInteraction) {
        infoPanel.style.backgroundColor = 'rgba(255, 215, 0, 0.8)';
        infoPanel.style.color = '#000';
    } else {
         infoPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
         infoPanel.style.color = '#fff';
    }
}

function endGame(isVictory) {
    gameState.isGameOver = true;
    const modal = document.getElementById('game-over-modal');
    const title = modal.querySelector('h1');
    if (isVictory) {
        title.textContent = "クリア！";
        title.style.color = "#ffd700";
    } else {
        title.textContent = "ゲームオーバー";
        title.style.color = "#ff4444";
    }
    modal.style.display = 'flex';
    renderer.setAnimationLoop(null);
}

function animate() {
    const delta = clock.getDelta();
    if (clock.elapsedTime > 1 && !gameState.gameStarted) {
        gameState.gameStarted = true;
    }
    
    if (gameState.activeTeleportEffect) {
        gameState.activeTeleportEffect.update(delta);
    }

    animatePlayer(delta);
    updateMonsters(delta);
    ProjectileManager.update(delta);
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// --- EVENT LISTENERS ---
window.addEventListener('keydown', (event) => {
    if (gameState.isInteractionActive) {
        if (event.key === ' ') GameManager.hideMessage();
        return;
    }
    if (gameState.isGameOver) return;

    switch(event.key) {
        case "w": case "W": Player.queueMove("forward"); break;
        case "s": case "S": Player.queueMove("backward"); break;
        case "a": case "A": Player.queueMove("left"); break;
        case "d": case "D": Player.queueMove("right"); break;
        case 'e': case 'E': Player.attack(); break;
        case ' ': Player.interact(); break;
        case 'c': case 'C': GameManager.toggleCheatMode(); break;
        case 'f': case 'F': Player.setBlocking(true); break;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'f' || event.key === 'F') {
        Player.setBlocking(false);
    }
});

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 350;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('restart-button').addEventListener('click', () => {
    GameManager.restartGame();
});

updatePlayerStats();
