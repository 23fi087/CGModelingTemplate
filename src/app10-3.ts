//23FI087 成田薫平

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;

    constructor() {

    }

    // 画面部分の作成
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
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

    // シーンの作成
    private createScene = () => {
        this.scene = new THREE.Scene();

        // メッシュの生成
        const geometry = new THREE.ConeGeometry(0.25, 1);
        const redMaterial = new THREE.MeshPhongMaterial({ color: 0xFF0000 });
        const greenMaterial = new THREE.MeshPhongMaterial({ color: 0x00FF00 });
        const blueMaterial =  new THREE.MeshPhongMaterial({ color: 0x0000FF });
        const redCone = new THREE.Mesh(geometry, redMaterial);
        const greenCone = new THREE.Mesh(geometry, greenMaterial);
        const blueCone = new THREE.Mesh(geometry, blueMaterial);

        redCone.translateX(0.5);
        redCone.rotateZ(-Math.PI / 2);
        greenCone.translateY(0.5);
        blueCone.translateZ(0.5);
        blueCone.rotateX(Math.PI / 2);

        const obj : THREE.Group = new THREE.Group();
        obj.add(redCone);
        obj.add(greenCone);
        obj.add(blueCone);
        this.scene.add(obj);

        // グリッド・軸
        this.scene.add(new THREE.GridHelper(10));
        this.scene.add(new THREE.AxesHelper(5));

        // ライトの追加
        this.light = new THREE.DirectionalLight(0xffffff);
                const lvec = new THREE.Vector3(1, 1, 1).normalize();
                this.light.position.set(lvec.x, lvec.y, lvec.z);
                this.scene.add(this.light);

        

        // ベジェ関数
        const bezier = (
          p0: THREE.Vector3, p1: THREE.Vector3,
          p2: THREE.Vector3, p3: THREE.Vector3,
          t: number
        ): THREE.Vector3 => {
          const oneMinusT = 1 - t;
          return new THREE.Vector3()
            .add(p0.clone().multiplyScalar(oneMinusT ** 3))
            .add(p1.clone().multiplyScalar(3 * oneMinusT ** 2 * t))
            .add(p2.clone().multiplyScalar(3 * oneMinusT * t ** 2))
            .add(p3.clone().multiplyScalar(t ** 3));
        };

        // 制御点
        const p0 = new THREE.Vector3(-4, 0, 0);
        const p1 = new THREE.Vector3(4, 0, 4);
        const p2 = new THREE.Vector3(5, 0, 4);
        const p3 = new THREE.Vector3(5, 0, 0);

        // 1.累積距離テーブルを作る
        const sampleCount = 200;
        let arcLengths: number[] = [0];
        let prev = bezier(p0, p1, p2, p3, 0);
        let totalLength = 0;
        for (let i = 1; i <= sampleCount; i++) {
            const t = i / sampleCount;
            const curr = bezier(p0, p1, p2, p3, t);
            totalLength += curr.distanceTo(prev);
            arcLengths.push(totalLength);
            prev = curr;
        }

        // 2. アニメーション
        const clock = new THREE.Clock();
        const duration = 1.0; 

        let update: FrameRequestCallback = () => {
            const elapsed = clock.getElapsedTime() % duration;
            const targetLen = (elapsed / duration) * totalLength;

            // 3. 二分探索
            let low = 0, high = sampleCount;
            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                if (arcLengths[mid] < targetLen) low = mid + 1;
                else high = mid;
            }
            // 線形補間でtを求める
            const t1 = (low - 1) / sampleCount;
            const t2 = low / sampleCount;
            const l1 = arcLengths[low - 1];
            const l2 = arcLengths[low];
            const t = l1 === l2 ? t1 : t1 + (targetLen - l1) / (l2 - l1) * (t2 - t1);

            // 位置計算
            const pos = bezier(p0, p1, p2, p3, t);
            obj.position.copy(pos);

            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
    
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(5, 7, 5));
    document.body.appendChild(viewport);
}
