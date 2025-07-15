//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as CANNON from "cannon-es";


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

        // --物理の作成--
        const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19.62, 0) });
        world.defaultContactMaterial.restitution = 0.8;
        world.defaultContactMaterial.friction = 0.03;

        
        const wheelMaterial = new CANNON.Material('wheelMaterial');
        wheelMaterial.friction = 1.0;
        const groundMaterial = new CANNON.Material('groundMaterial');
        groundMaterial.friction = 1.0;

        
        const wheelGroundContactMaterial = new CANNON.ContactMaterial(
            wheelMaterial,
            groundMaterial,
            {
                friction: 0.01, 
                restitution: 0.8
            }
        );
        world.addContactMaterial(wheelGroundContactMaterial);

        // --- 車体の作成 ---
        const carBody = new CANNON.Body({ mass: 5});
        const carBodyShape = new CANNON.Box(new CANNON.Vec3(4, 0.5, 2));
        carBody.addShape(carBodyShape);
        carBody.position.set(0, 0.7, 0); // Y座標をタイヤの半径と一緒

        // --- RigidVehicleの作成 ---
        const vehicle = new CANNON.RigidVehicle({ chassisBody: carBody });
        // vehicle.addToWorld(world);

        // --- タイヤの作成（4輪） ---
        const wheelBodies: CANNON.Body[] = [];
        const wheelMeshes: THREE.Mesh[] = [];
        const wheelPositions = [
            new CANNON.Vec3(-2, 0, 2.5),
            new CANNON.Vec3( 2, 0, 2.5),
            new CANNON.Vec3(-2, 0, -2.5),
            new CANNON.Vec3( 2, 0, -2.5)
        ];
        for (let i = 0; i < 4; i++) {
            const wheelShape = new CANNON.Sphere(0.7);
            const wheelBody = new CANNON.Body({ mass: 1, material: wheelMaterial });
            wheelBody.addShape(wheelShape);
            wheelBody.angularDamping = 0.4;
            vehicle.addWheel({
                body: wheelBody,
                position: wheelPositions[i],
                direction: new CANNON.Vec3(0, 0, 0),
                axis: new CANNON.Vec3(0, 0, 1)
            });
            wheelBodies.push(wheelBody);
            vehicle.addToWorld(world);
            // Three.js側のメッシュ
            const wheelGeometry = new THREE.SphereGeometry(0.7);
            const wheelMaterial3 = new THREE.MeshNormalMaterial();
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial3);
            this.scene.add(wheelMesh);
            wheelMeshes.push(wheelMesh);
        }
        vehicle.addToWorld(world);
        // --- 地面の作成 ---
        const phongMaterial = new THREE.MeshPhongMaterial();
        const planeGeometry = new THREE.PlaneGeometry(50, 50);
        const planeMesh = new THREE.Mesh(planeGeometry, phongMaterial);
        planeMesh.material.side = THREE.DoubleSide;
        planeMesh.rotateX(-Math.PI / 2);
        this.scene.add(planeMesh);

        const planeShape = new CANNON.Plane();
        const planeBody = new CANNON.Body({ mass: 0, material: groundMaterial });
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

        // Three.js側の車体 
        const boxGeometry = new THREE.BoxGeometry(8, 1, 4);
        const boxMaterial = new THREE.MeshNormalMaterial();
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        this.scene.add(boxMesh);

        // 角度を度からラジアンに変換する
        const degToRad = (deg: number) => deg * Math.PI / 180;

        // 力・角度の変数
        let forward = 0;
        let steer = 0;

        // キーが押されたとき
        document.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'ArrowUp':
                    forward = 20;
                    break;
                case 'ArrowDown':
                    forward = -20;
                    break;
                case 'ArrowLeft':
                    steer = degToRad(-30);
                    break;
                case 'ArrowRight':
                    steer = degToRad(30);
                    break;
            }
        });

        // キーが離されたとき
        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case 'ArrowUp':
                case 'ArrowDown':
                    forward = 0;
                    break;
                case 'ArrowLeft':
                case 'ArrowRight':
                    steer = 0;
                    break;
            }
        });

        // --- アニメーションループ ---
        let update: FrameRequestCallback = (time) => {
            world.fixedStep();

            // 車体の位置・回転を同期
            boxMesh.position.set(carBody.position.x, carBody.position.y, carBody.position.z);
            boxMesh.quaternion.set(carBody.quaternion.x, carBody.quaternion.y, carBody.quaternion.z, carBody.quaternion.w);

            // タイヤの位置・回転を同期
            for (let i = 0; i < 4; i++) {
                wheelMeshes[i].position.set(
                    wheelBodies[i].position.x,
                    wheelBodies[i].position.y,
                    wheelBodies[i].position.z
                );
                wheelMeshes[i].quaternion.set(
                    wheelBodies[i].quaternion.x,
                    wheelBodies[i].quaternion.y,
                    wheelBodies[i].quaternion.z,
                    wheelBodies[i].quaternion.w
                );
            }

            // 前輪に力を加える
            vehicle.setWheelForce(forward, 0);
            vehicle.setWheelForce(forward, 1);

            
            vehicle.setSteeringValue(steer, 0);
            vehicle.setSteeringValue(steer, 1);

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
