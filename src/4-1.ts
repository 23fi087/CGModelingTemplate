//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;

    constructor() {

    }

    
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        let renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
        renderer.shadowMap.enabled = true; 

        //カメラの設定
        let camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
       
        camera.position.set(0, 2, 8); 
        camera.lookAt(new THREE.Vector3(0, 1.5, 0)); 

        let orbitControls = new OrbitControls(camera, renderer.domElement);

        this.createScene();
        
        
        let render: FrameRequestCallback = (time) => {
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
        this.scene = new THREE.Scene();

        //ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        let lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);
    
        
        let points: THREE.Vector2[] = [];
        let scaleFactor = 0.1; //（幅を調整）
        let step = 0.1; // xの増加

        // 指数関数 y = exp(x) 
        for (let x = 0; x <= 2; x += step) {
            points.push(new THREE.Vector2(Math.exp(x) * scaleFactor, x));
        }

        // LatheGeometryを作成
        let hornGeometry = new THREE.LatheGeometry(points, 10); 
        let hornMaterial = new THREE.MeshNormalMaterial({
           
            side: THREE.DoubleSide,//サイドが反映されないのを防止
            
        });
        let hornMesh = new THREE.Mesh(hornGeometry, hornMaterial);

        // シーンに追加
        this.scene.add(hornMesh);

       
        let update: FrameRequestCallback = (time) => {

            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 3));
    document.body.appendChild(viewport);
}
