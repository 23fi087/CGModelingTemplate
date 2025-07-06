
//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as TWEEN from "@tweenjs/tween.js";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;
    private cloud: THREE.Points;
    private particleNum = 60000;
    private tweenInfos: any[] = [];

    constructor() {

    }

    // 画面部分の作成(表示する枠ごとに)*
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x000000)); // 黒
        renderer.shadowMap.enabled = true; //シャドウマップを有効にする

        //カメラの設定
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 0, 40); 
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const orbitControls = new OrbitControls(camera, renderer.domElement);

        this.createScene();
        // 毎フレームのupdateを呼んで，render
        // reqestAnimationFrame により次フレームを呼ぶ
        const render: FrameRequestCallback = (time) => {
            orbitControls.update();
            TWEEN.update();
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
        
        //ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);
    
        // パーティクル
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleNum * 3);
        for (let i = 0; i < this.particleNum; i++) {
            positions[i * 3 + 0] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.3,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            map: this.generateSprite(),
            depthWrite: false
        });
        this.cloud = new THREE.Points(geometry, material);
        this.scene.add(this.cloud);

       
        for (let i = 0; i < this.particleNum; i++) {
            let tweeninfo = { x: 0, y: 0, z: 0, index: i };

           
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 15;
            const tx = r * Math.sin(phi) * Math.cos(theta);
            const ty = r * Math.sin(phi) * Math.sin(theta);
            const tz = r * Math.cos(phi);

            // 原点→球面
            const tween1 = new TWEEN.Tween(tweeninfo)
                .to({ x: tx, y: ty, z: tz }, 2000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    const pos = (this.cloud.geometry as THREE.BufferGeometry).getAttribute('position');
                    pos.setX(tweeninfo.index, tweeninfo.x);
                    pos.setY(tweeninfo.index, tweeninfo.y);
                    pos.setZ(tweeninfo.index, tweeninfo.z);
                    pos.needsUpdate = true;
                });

            // 球面→原点
            const tween2 = new TWEEN.Tween(tweeninfo)
                .to({ x: 0, y: 0, z: 0 }, 2000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    const pos = (this.cloud.geometry as THREE.BufferGeometry).getAttribute('position');
                    pos.setX(tweeninfo.index, tweeninfo.x);
                    pos.setY(tweeninfo.index, tweeninfo.y);
                    pos.setZ(tweeninfo.index, tweeninfo.z);
                    pos.needsUpdate = true;
                });

            tween1.chain(tween2);
            tween2.chain(tween1);
            tween1.start();

            this.tweenInfos.push(tweeninfo);
        }

        setInterval(() => {
            
        }, 500); 
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

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 40));
    document.body.appendChild(viewport);
}
