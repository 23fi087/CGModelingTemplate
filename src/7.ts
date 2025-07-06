//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;

    constructor() {
        this.scene = new THREE.Scene();
    }
    
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
        renderer.shadowMap.enabled = true; 

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

    private createScene = () => {
        // 頂点座標の定義（8頂点、各辺の長さ1）
        const vertices = new Float32Array([
            -0.5, -0.5, -0.5,  // 頂点0: 
             0.5, -0.5, -0.5,  // 頂点1: 
             0.5,  0.5, -0.5,  // 頂点2: 
            -0.5,  0.5, -0.5,  // 頂点3: 
            -0.5, -0.5,  0.5,  // 頂点4: 
             0.5, -0.5,  0.5,  // 頂点5: 
             0.5,  0.5,  0.5,  // 頂点6:
            -0.5,  0.5,  0.5   // 頂点7: 
        ]);

        // 各頂点の色を定義
        const colors = new Float32Array([
            0.0, 0.0, 0.0,  // 黒    (頂点0)
            1.0, 1.0, 1.0,  // 白    (頂点1)
            1.0, 0.0, 0.0,  // 赤    (頂点2)
            0.0, 1.0, 0.0,  // 緑    (頂点3)
            0.0, 0.0, 1.0,  // 青    (頂点4)
            1.0, 1.0, 0.0,  // 黄    (頂点5)
            0.0, 1.0, 1.0,  // シアン (頂点6)
            1.0, 0.0, 1.0   // マゼンタ(頂点7)
        ]);

        // 6面×2三角形×3頂点
        const indices = new Uint16Array([
            0, 1, 2,  0, 2, 3,  // 前面
            1, 5, 6,  1, 6, 2,  // 右面
            5, 4, 7,  5, 7, 6,  // 背面
            4, 0, 3,  4, 3, 7,  // 左面
            3, 2, 6,  3, 6, 7,  // 上面
            4, 5, 1,  4, 1, 0   // 下面
        ]);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);

        // ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);
    }
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();
    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(2, 2, 2));
    document.body.appendChild(viewport);
}
