//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as TWEEN from "@tweenjs/tween.js";
class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;

    constructor() {

    }

    // 画面部分の作成(表示する枠ごとに)*
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
        renderer.shadowMap.enabled = true; //シャドウマップを有効にする

        //カメラの設定
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 2, 0));

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

        // 赤いキューブ
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshPhongMaterial({ color: 0xFF0000 });
        const cube = new THREE.Mesh(geometry, material);
        this.scene.add(cube);

        // 緑のキューブ
        const greenCubeGeometry = new THREE.BoxGeometry();
        const greenMaterial = new THREE.MeshPhongMaterial({ color: 0x00FF00 });
        const greenCube = new THREE.Mesh(greenCubeGeometry, greenMaterial);
        this.scene.add(greenCube);

        // ひし形座標
        const points = [
            { x: 0, y: -4, z: 0 },
            { x: -4, y: 0, z: 0 }, 
            { x: 0, y: 4, z: 0 },  
            { x: 4, y: 0, z: 0 }   
        ];

        
        cube.position.set(points[0].x, points[0].y, points[0].z);
        
        greenCube.position.set(points[2].x, points[2].y, points[2].z);

      
        const tweens = [];
        for (let i = 0; i < points.length; i++) {
            const next = (i + 1) % points.length;
            tweens[i] = new TWEEN.Tween(cube.position)
                .to(points[next], 1000)
                .easing(TWEEN.Easing.Elastic.Out);
        }
        for (let i = 0; i < tweens.length; i++) {
            tweens[i].chain(tweens[(i + 1) % tweens.length]);
        }
        tweens[0].start();

        
        const greenTweens = [];
        for (let i = 0; i < points.length; i++) {
            
            const next = (i + 1) % points.length;
            greenTweens[i] = new TWEEN.Tween(greenCube.position)
                .to(points[(next + 2) % points.length], 1000)
                .easing(TWEEN.Easing.Elastic.Out);
        }
        for (let i = 0; i < greenTweens.length; i++) {
            greenTweens[i].chain(greenTweens[(i + 1) % greenTweens.length]);
        }
        greenTweens[0].start();

        // ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);

        
        let update: FrameRequestCallback = (time) => {
            TWEEN.update(time);
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
    
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 4, 10));
    document.body.appendChild(viewport);
}
