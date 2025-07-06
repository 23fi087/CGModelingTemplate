//23FI087
//成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;
    private cloud: THREE.Points;
    private particleVelocity: THREE.Vector3[];
    private clock: THREE.Clock;

    constructor() {
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
    }

    private generateSprite = () => {
        let canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;

        let context = canvas.getContext('2d');
        let gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(0,255,255,1)');
        gradient.addColorStop(0.4, 'rgba(0,128,255,1)');
        gradient.addColorStop(1, 'rgba(0,0,64,0)');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        let texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

   
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

    // シーンの作成(全体で1回)
    private createScene = () => {
        this.scene = new THREE.Scene();
        
        let createParticles = () => {
            const geometry = new THREE.BufferGeometry();
            const particleNum = 20000; 
            const positions = new Float32Array(particleNum * 3);
            let particleIndex = 0;

            this.particleVelocity = [];

           
            for(let i = 0; i < particleNum; i++) {
                positions[particleIndex++] = Math.random() * 30 - 15;  
                positions[particleIndex++] = Math.random() * 40 - 10;  
                positions[particleIndex++] = Math.random() * 30 - 15;  

                // 速度設定
                this.particleVelocity.push(new THREE.Vector3(
                    Math.random() * 0.1 - 0.05,   
                    -Math.random() * 20.0,   
                    Math.random() * 0.1 - 0.05    
                ));
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            // マテリアルの作成
            const material = new THREE.PointsMaterial({
                size: 0.8,
                map: this.generateSprite(),
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: 0.8
            });

            this.cloud = new THREE.Points(geometry, material);
            this.scene.add(this.cloud);
        }

        createParticles();

        // ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);

        // アニメーション
        let update: FrameRequestCallback = (time) => {
            const deltaTime = this.clock.getDelta();
            const positions = this.cloud.geometry.getAttribute('position');

            for(let i = 0; i < this.particleVelocity.length; i++) {
                positions.setY(i, positions.getY(i) + this.particleVelocity[i].y * deltaTime);
                positions.setX(i, positions.getX(i) + this.particleVelocity[i].x * deltaTime);
                positions.setZ(i, positions.getZ(i) + this.particleVelocity[i].z * deltaTime);

                
                if(positions.getY(i) < -10) {
                    positions.setY(i, 30);
                    positions.setX(i, Math.random() * 30 - 15);
                    positions.setZ(i, Math.random() * 30 - 15);
                }
            }

            positions.needsUpdate = true;
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
    
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 10));
    document.body.appendChild(viewport);
}
