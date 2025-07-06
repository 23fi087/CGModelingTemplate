//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as TWEEN from "@tweenjs/tween.js";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;
    private particles: THREE.Points;
    private morphTargets: Array<THREE.Vector3[]>;
    private currentMorph: number = 0;
    private PARTICLE_COUNT = 8000;

    constructor() {

    }

    // 画面部分の作成(表示する枠ごとに)*
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x000000));
        renderer.shadowMap.enabled = true; //シャドウマップを有効にする

        //カメラの設定
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const orbitControls = new OrbitControls(camera, renderer.domElement);

        this.createScene();
        // 毎フレームのupdateを呼んで，render
        // reqestAnimationFrame により次フレームを呼ぶ
        const render: FrameRequestCallback = (time) => {
            orbitControls.update();

            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);

        renderer.domElement.style.cssFloat = "left";
        renderer.domElement.style.margin = "10px";
        return renderer.domElement;
    }

    // シーンの作成
    private createScene = () => {
        this.scene = new THREE.Scene();
        // 光る点
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.PARTICLE_COUNT * 3);
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 4;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.15,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            map: this.generateSprite(),
            depthWrite: false
        });
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        // 球、立方体、トーラス
        this.morphTargets = [
            this.createSpherePoints(3.5),
            this.createCubePoints(5.0),
            this.createTorusPoints(3.5, 1.2)
        ];
        // 初期形状を球に
        this.setParticlePositions(this.morphTargets[0]);

        // ライト
        this.light = new THREE.DirectionalLight(0xffffff, 1.2);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        // アニメーションループ
        let update: FrameRequestCallback = (time) => {
            TWEEN.update(time);
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);

       
        this.startMorphLoop();
    }
    
    // パーティクル座標
    private setParticlePositions(target: THREE.Vector3[]) {
        const pos = this.particles.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            pos.setXYZ(i, target[i].x, target[i].y, target[i].z);
        }
        pos.needsUpdate = true;
    }

    // 球状の点群
    private createSpherePoints(radius: number): THREE.Vector3[] {
        const arr: THREE.Vector3[] = [];
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            arr.push(new THREE.Vector3(x, y, z));
        }
        return arr;
    }
    // 立方体状の点群
    private createCubePoints(size: number): THREE.Vector3[] {
        const arr: THREE.Vector3[] = [];
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            arr.push(new THREE.Vector3(
                (Math.random() - 0.5) * size,
                (Math.random() - 0.5) * size,
                (Math.random() - 0.5) * size
            ));
        }
        return arr;
    }
    // トーラス状の点群
    private createTorusPoints(radius: number, tube: number): THREE.Vector3[] {
        const arr: THREE.Vector3[] = [];
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const u = Math.random() * 2 * Math.PI;
            const v = Math.random() * 2 * Math.PI;
            const x = (radius + tube * Math.cos(v)) * Math.cos(u);
            const y = (radius + tube * Math.cos(v)) * Math.sin(u);
            const z = tube * Math.sin(v);
            arr.push(new THREE.Vector3(x, y, z));
        }
        return arr;
    }
    // モーフィングアニメーション
    private startMorphLoop() {
        const nextMorph = () => {
            const from = [];
            const pos = this.particles.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < this.PARTICLE_COUNT; i++) {
                from.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
            }
            this.currentMorph = (this.currentMorph + 1) % this.morphTargets.length;
            const to = this.morphTargets[this.currentMorph];
            const tweenObj = { t: 0 };
            new TWEEN.Tween(tweenObj)
                .to({ t: 1 }, 1800)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
                        const x = from[i].x + (to[i].x - from[i].x) * tweenObj.t;
                        const y = from[i].y + (to[i].y - from[i].y) * tweenObj.t;
                        const z = from[i].z + (to[i].z - from[i].z) * tweenObj.t;
                        pos.setXYZ(i, x, y, z);
                    }
                    pos.needsUpdate = true;
                })
                .onComplete(() => {
                    setTimeout(nextMorph, 600); 
                })
                .start();
        };
        nextMorph();
    }
    
    private generateSprite(): THREE.Texture {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.Texture();
        
        const gradient = ctx.createRadialGradient(
            size / 2, size / 2, 0, 
            size / 2, size / 2, size / 2 
        );
        gradient.addColorStop(0, 'rgba(0,160,255,1)'); 
        gradient.addColorStop(0.2, 'rgba(0,160,255,1)');
        gradient.addColorStop(0.4, 'rgba(0,80,255,0.6)');
        gradient.addColorStop(1, 'rgba(0,0,64,0)'); 
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();
    
    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 8));
    document.body.appendChild(viewport);
}
