//23FI087
//成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private clock: THREE.Clock;
    private particles: THREE.Points[];
    private particleVelocities: THREE.Vector3[][];
    private readonly PARTICLE_COUNT = 1000;

    constructor() {
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.particles = [];
        this.particleVelocities = [];
    }

    private createScene = () => {
        this.scene = new THREE.Scene();

      
        const textureLoader = new THREE.TextureLoader();
        
        
        const textures = [
            textureLoader.load('ya.png'),
            
        ];

       
        textures.forEach(texture => {
            this.initParticleSystem(texture);
        });

        // アニメーション処理
        const animate = () => {
            const deltaTime = this.clock.getDelta();

            this.particles.forEach((particle, systemIndex) => {
                const positions = particle.geometry.attributes.position.array as Float32Array;
                const velocities = this.particleVelocities[systemIndex];

                for (let i = 0; i < this.PARTICLE_COUNT; i++) {
                    const i3 = i * 3;
                    positions[i3] += velocities[i].x * deltaTime;
                    positions[i3 + 1] += velocities[i].y * deltaTime;
                    positions[i3 + 2] += velocities[i].z * deltaTime;

                   
                    if (Math.abs(positions[i3]) > 20) velocities[i].x *= -1;
                    if (Math.abs(positions[i3 + 1]) > 20) velocities[i].y *= -1;
                    if (Math.abs(positions[i3 + 2]) > 20) velocities[i].z *= -1;
                }

                particle.geometry.attributes.position.needsUpdate = true;
            });

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    private initParticleSystem = (texture: THREE.Texture) => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.PARTICLE_COUNT * 3);
        const velocities: THREE.Vector3[] = [];

        
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] = Math.random() * 40 - 20;
            positions[i3 + 1] = Math.random() * 40 - 20;
            positions[i3 + 2] = Math.random() * 40 - 20;

            velocities.push(new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            size: 1.0,
            map: texture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });

        const points = new THREE.Points(geometry, material);
        this.particles.push(points);
        this.particleVelocities.push(velocities);
        this.scene.add(points);
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
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 10));
    document.body.appendChild(viewport);
}
