//23FI087 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;
    private bladeGroup: THREE.Group; 

    constructor() {}

    
    public createRendererDOM = (width: number, height: number, cameraPos: THREE.Vector3) => {
        let renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
        renderer.shadowMap.enabled = true; 

        //カメラの設定
        let camera = new THREE.PerspectiveCamera(120, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        let orbitControls = new OrbitControls(camera, renderer.domElement);

        this.createScene();
       
        let render: FrameRequestCallback = (time) => {
            orbitControls.update();

            // 羽根を回転させる
            if (this.bladeGroup) {
                this.bladeGroup.rotation.z -= 0.05; // 時計回りに回転
            }

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
        this.light = new THREE.DirectionalLight(0xffffff, 1); 
        let lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
        this.scene.add(ambientLight);

        // 扇風機を作成
        this.createFan();
    }

    private createFanCover = () => {
        // 外枠のカバーを作成
        const outerRingGeometry = new THREE.TorusGeometry(1.6, 0.05, 16, 100); 
        const outerRingMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
        outerRing.rotation.x = Math.PI / 2; 
        outerRing.position.set(0, 1.5, 0);
        this.scene.add(outerRing);

        // 放射状の線を作成
        const radialLineMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc });
        const radialLineGroup = new THREE.Group();
        for (let i = 0; i < 32; i++) { 
            const lineGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                0, 1.5, 0, 
                Math.sin((i * Math.PI * 2) / 32) * 1.5, 1.5, Math.cos((i * Math.PI * 2) / 32) * 1.5 
            ]);
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            const line = new THREE.Line(lineGeometry, radialLineMaterial);
            radialLineGroup.add(line);
        }
        this.scene.add(radialLineGroup);

        // 中心の円を作成
        const centerCircleGeometry = new THREE.CircleGeometry(0.3, 32); // 中心の円
        const centerCircleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const centerCircle = new THREE.Mesh(centerCircleGeometry, centerCircleMaterial);
        centerCircle.rotation.x = -Math.PI / 2; 
        centerCircle.position.set(0, 1.5, 0);
        this.scene.add(centerCircle);
    }
    

    private createFanCage = () => {
        // カバー断面の形
        const points: THREE.Vector2[] = [];
        for (let i = 0; i <= 10; i++) {
            const x = Math.sin((i / 10) * Math.PI) * 1.5; 
            const y = (i / 10) * 0.5; 
            points.push(new THREE.Vector2(x, y));
        }

        
        const cageGroup = new THREE.Group();

        // 前面のカバー
        const frontCageGeometry = new THREE.LatheGeometry(points, 32);
        const frontCageMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            wireframe: true,
        });
        const frontCage = new THREE.Mesh(frontCageGeometry, frontCageMaterial);
        frontCage.rotation.x = Math.PI / 2; 
        frontCage.position.set(0, 1.5, 0.); 
        cageGroup.add(frontCage);

        // 背面のカバー
        const backCageGeometry = new THREE.LatheGeometry(points, 32);
        const backCageMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            wireframe: true,
        });
        const backCage = new THREE.Mesh(backCageGeometry, backCageMaterial);
        backCage.rotation.x = Math.PI / 2; 
        backCage.position.set(0, 1.5, -0.5); 
        cageGroup.add(backCage);

        // 前面と背面をつなぐ
        const sideCageGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 64, 1, true); 
        const sideCageMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            wireframe: true,
            side: THREE.DoubleSide,
        });
        const sideCage = new THREE.Mesh(sideCageGeometry, sideCageMaterial);
        sideCage.rotation.x = Math.PI / 2; 
        sideCage.position.set(0, 1.5, 0); 
        cageGroup.add(sideCage);

        // 外枠の白い円
        const outerRingGeometry = new THREE.TorusGeometry(1.6, 0.05, 16, 100); 
        const outerRingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
        outerRing.position.set(0, 1.5, 0);
        cageGroup.add(outerRing);

        
        this.scene.add(cageGroup);
    };

    private createFan = () => {
        
        const baseGeometry = new THREE.CylinderGeometry(1, 1.2, 0.5, 32);
        const baseMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff }); // 白
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, -2, 0);
        this.scene.add(base);

        // 支柱部分
        const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3.3, 32);
        const poleMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff }); // 白
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(0, -0.1, 0);
        this.scene.add(pole);

        
        const fanGroup = new THREE.Group();

        // 長方形部分）
        const boxShape = new THREE.Shape();
        boxShape.moveTo(-0.5, -0.3); // 左下
        boxShape.lineTo(0.5, -0.5);  // 右下
        boxShape.lineTo(0.5, 0.5);   // 右上
        boxShape.lineTo(-0.5, 0.5);  // 左上
        boxShape.lineTo(-0.5, -0.5); // 左下に戻る

        const extrudeSettings = {
            steps: 1,
            depth: 2, 
            bevelEnabled: false,
        };

        const boxGeometry = new THREE.ExtrudeGeometry(boxShape, extrudeSettings);
        const boxMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff }); // 白
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(0, 1.5, -2); 
        fanGroup.add(box); 

        // 羽根部分
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, -1.5); 
        bladeShape.quadraticCurveTo(0.3, -1, 0, 0); 
        bladeShape.quadraticCurveTo(-0.3, -1, 0, -1.5);

        const bladeExtrudeSettings = {
            steps: 1,
            depth: 0.05, 
            bevelEnabled: false,
        };

        const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, bladeExtrudeSettings);
        const bladeMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc }); 

        this.bladeGroup = new THREE.Group(); 
        const bladeCount = 6; // 羽根の数
        for (let i = 0; i < bladeCount; i++) {
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            blade.rotation.z = (i * 2 * Math.PI) / bladeCount; 
            this.bladeGroup.add(blade);
        }
        this.bladeGroup.position.set(0, 1.5, 0); 
        fanGroup.add(this.bladeGroup); 

        // カバー部分
        this.createFanCage();
        fanGroup.add(this.scene.children.pop()!); 

       
        fanGroup.position.set(0, 0, 1); 
        this.scene.add(fanGroup);
    };
}

window.addEventListener("DOMContentLoaded", init);

function init() {
    let container = new ThreeJSContainer();

    let viewport = container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 3));
    document.body.appendChild(viewport);
}
