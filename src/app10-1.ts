//23FI087 成田薫平

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;

    constructor() {

    }

   
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

       
        this.scene.add(new THREE.GridHelper(10));
        this.scene.add(new THREE.AxesHelper(5));

        // ライトの追加
        this.light = new THREE.DirectionalLight(0xffffff);
                const lvec = new THREE.Vector3(1, 1, 1).normalize();
                this.light.position.set(lvec.x, lvec.y, lvec.z);
                this.scene.add(this.light);

        

        // エルミート関数
        let hermite = (
          p0: THREE.Vector3, v0: THREE.Vector3,
          p1: THREE.Vector3, v1: THREE.Vector3,
          t: number
        ): THREE.Vector3 => {
          const t2 = t * t;
          const t3 = t2 * t;

          const h00 = 2 * t3 - 3 * t2 + 1;
          const h10 = t3 - 2 * t2 + t;
          const h01 = -2 * t3 + 3 * t2;
          const h11 = t3 - t2;

          return new THREE.Vector3()
            .add(p0.clone().multiplyScalar(h00))
            .add(v0.clone().multiplyScalar(h10))
            .add(p1.clone().multiplyScalar(h01))
            .add(v1.clone().multiplyScalar(h11));
        };

        // 通過点
        const points = [
          new THREE.Vector3(0, 0, -4),   // P0
          new THREE.Vector3(0, 0, 2),    // P1
          new THREE.Vector3(2, 0, 2),    // P2
          new THREE.Vector3(0, 2, 0),    // P3
          new THREE.Vector3(-4, 2, 0),   // P4
        ];

        // 速度ベクトル
        const velocities = [
          points[1].clone().sub(points[0]).multiplyScalar(1), // v0
          points[2].clone().sub(points[0]).multiplyScalar(0.5), // v1
          points[3].clone().sub(points[1]).multiplyScalar(0.5), // v2
          points[4].clone().sub(points[2]).multiplyScalar(0.5), // v3
          points[4].clone().sub(points[3]).multiplyScalar(1),   // v4
        ];

        // アニメーション
        let seg = 0;
        let t = 0;
        const clock = new THREE.Clock();

        let update: FrameRequestCallback = () => {
          t += clock.getDelta();
          if (t > 1.0) {
            t = 0;
            seg = (seg + 1) % 4; 
          }

          
          const p0 = points[seg];
          const p1 = points[seg + 1];
          const v0 = velocities[seg];
          const v1 = velocities[seg + 1];

          const pos = hermite(p0, v0, p1, v1, t);
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
