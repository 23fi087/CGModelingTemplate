//23FI087
//成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private torusRings: THREE.Points[] = [];
    private clock: THREE.Clock;

    constructor() {
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
    }

   
    private generateSprite = (color: string) => {
        let canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;

        let context = canvas.getContext('2d');
        let gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );

        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, color);
        gradient.addColorStop(0.4, color.replace('1)', '0.3)'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        let texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

   
    private createPoints = (geom: THREE.BufferGeometry, color: string) => {
        let material = new THREE.PointsMaterial({
            size: 0.15,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            map: this.generateSprite(color)
        });
        return new THREE.Points(geom, material);
    }

    private createScene = () => {
        this.scene = new THREE.Scene();

        const colors = [
            'rgba(255,0,0,1)',   // 赤
            'rgba(0,255,0,1)',   // 緑
            'rgba(0,0,255,1)'    // 青
        ];

      
        const numRings = 15;
        const radius = 5;
        const torusGeom = new THREE.TorusGeometry(0.8, 0.2, 16, 50);

        for (let i = 0; i < numRings; i++) {
            const angle = (i / numRings) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

           
            const ring = this.createPoints(torusGeom, colors[i % 3]);
            ring.position.set(x, 0, z);
            ring.rotation.y = angle + Math.PI / 2;
            
            this.torusRings.push(ring);
            this.scene.add(ring);
        }

        // アニメーション設定
        const animate = () => {
            const deltaTime = this.clock.getDelta();

            this.torusRings.forEach((ring, index) => {
                
                ring.rotation.x += (0.5 + index * 0.1) * deltaTime;
                ring.rotation.z += (0.3 + index * 0.05) * deltaTime;
            });

            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }

    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000);  // 背景を黒

        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const orbitControls = new OrbitControls(camera, renderer.domElement);

        this.createScene();

        const render = () => {
            orbitControls.update();
            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);

        return renderer.domElement;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const container = new ThreeJSContainer();
    const viewport = container.createRendererDOM(
        800, 600,
        new THREE.Vector3(8, 6, 8)  
    );
    document.body.appendChild(viewport);
});
