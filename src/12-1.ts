//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as CANNON from 'cannon-es';

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
       
        camera.position.set(0, 7, 10);
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

    // シーンの作成(全体で1回)
    private createScene = () => {
        this.scene = new THREE.Scene();

        // 物理ワールドの作成
        const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19.62, 0) });
        world.defaultContactMaterial.friction = 0.5;
        world.defaultContactMaterial.restitution = 0.0;

        // ドミノの作成 
        const dominoCount = 32;
        const radius = 3.5;
        const dominos: THREE.Mesh[] = [];
        const dominoBodies: CANNON.Body[] = [];
        for (let i = 0; i < dominoCount; i++) {
            const width = 0.6, height = 1.2, depth = 0.15;
            
            const theta = (i / dominoCount) * Math.PI * 2;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            const y = height / 2 + 0.01;

            // Three.jsのドミノ
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
            const domino = new THREE.Mesh(geometry, material);
            domino.position.set(x, y, z);
            domino.castShadow = true;
            domino.receiveShadow = true;
            
            domino.rotation.y = -theta;
            // 最初のドミノだけ少し傾ける
            if (i === 0) {
                domino.rotation.x = Math.PI / 8; // x軸方向に傾ける
            }
            this.scene.add(domino);
            dominos.push(domino);

            // cannon-esのドミノ
            const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
            const body = new CANNON.Body({
                mass: 0.5,
                position: new CANNON.Vec3(x, y, z),
                shape: shape,
                material: new CANNON.Material({ friction: 0.1, restitution: 0.0 })
            });
            
            body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), -theta);
            // 最初のドミノだけz軸にも傾ける
            if (i === 0) {
                const q = new CANNON.Quaternion();
                q.setFromAxisAngle(new CANNON.Vec3(1,0,0), Math.PI/8); // x軸回転
                body.quaternion = body.quaternion.mult(q);
            }
            world.addBody(body);
            dominoBodies.push(body);
        }

        //  Three.jsの地面 
        const phongMaterial = new THREE.MeshPhongMaterial();
        const planeGeometry = new THREE.PlaneGeometry(25, 25);
        const planeMesh = new THREE.Mesh(planeGeometry, phongMaterial);
        planeMesh.material.side = THREE.DoubleSide;
        planeMesh.rotateX(-Math.PI / 2);
        this.scene.add(planeMesh);

        // cannon-esの地面 
        const planeShape = new CANNON.Plane();
        const planeBody = new CANNON.Body({ mass: 0 });
        planeBody.addShape(planeShape);
        planeBody.position.set(planeMesh.position.x, planeMesh.position.y, planeMesh.position.z);
        planeBody.quaternion.set(
            planeMesh.quaternion.x,
            planeMesh.quaternion.y,
            planeMesh.quaternion.z,
            planeMesh.quaternion.w
        );
        world.addBody(planeBody);

        // グリッド表示
        const gridHelper = new THREE.GridHelper( 10,);
        this.scene.add( gridHelper );  

        // 軸表示
        const axesHelper = new THREE.AxesHelper( 5 );
        this.scene.add( axesHelper );
        
        //ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff, 2.0);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);

        //  アニメーションループ 
        let update: FrameRequestCallback = (time) => {
            world.fixedStep();
            // ドミノの位置・回転を同期
            for (let i = 0; i < dominoCount; i++) {
                dominos[i].position.set(
                    dominoBodies[i].position.x,
                    dominoBodies[i].position.y,
                    dominoBodies[i].position.z
                );
                dominos[i].quaternion.set(
                    dominoBodies[i].quaternion.x,
                    dominoBodies[i].quaternion.y,
                    dominoBodies[i].quaternion.z,
                    dominoBodies[i].quaternion.w
                );
            }
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
    
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(5, 5, 5));
    document.body.appendChild(viewport);
}
