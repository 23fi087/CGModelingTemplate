// 学籍番号: 23FI087
// 氏名: 成田薫平
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;

    constructor() {

    }

   
    public createRendererDOM = async (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
        renderer.shadowMap.enabled = true; 

        //カメラの設定
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const orbitControls = new OrbitControls(camera, renderer.domElement);

        
        await this.createScene();
       
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

    private createScene = async () => {
        this.scene = new THREE.Scene();
        
        // OBJファイルの読み込み
        await this.addSceneFromObjFile("tri_mat.obj");

        //ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);
    }

   
    private async readMaterialFile(filePath: string): Promise<THREE.Color> {
        const mtlStr = await readFile(filePath);
        const lines = mtlStr.split("\n");
        let color = new THREE.Color();

        for(let line of lines) {
            const parts = line.trim().split(/\s+/);
            // Kdの行を見つける
            if(parts[0] === "Kd") {
                // RGB値をそれぞれ取得して色を設定
                color.setRGB(
                    parseFloat(parts[1]),  // R
                    parseFloat(parts[2]),  // G
                    parseFloat(parts[3])   // B
                );
                break;  //終了
            }
        }
        return color;
    }

    private async addSceneFromObjFile(filePath: string) {  
        const meshStr = await readFile(filePath);
        let mtlFileName = "";
        let vertices: number[] = [];
        let vertexIndices: number[] = [];

        const meshLines = meshStr.split("\n");
        for(let i = 0; i < meshLines.length; ++i) {
            const meshLine = meshLines[i].trim();
            const meshSpaceSplitArray = meshLine.split(/\s+/);

            const meshType = meshSpaceSplitArray[0];
            if(meshType === "mtllib") {
                
                mtlFileName = meshSpaceSplitArray[1];
            } else if(meshType === "v") {
                vertices.push(parseFloat(meshSpaceSplitArray[1]));
                vertices.push(parseFloat(meshSpaceSplitArray[2]));
                vertices.push(parseFloat(meshSpaceSplitArray[3]));
            } else if (meshType === "f") {
                const f1 = meshSpaceSplitArray[1].split("/");
                const f2 = meshSpaceSplitArray[2].split("/");
                const f3 = meshSpaceSplitArray[3].split("/");
                vertexIndices.push(parseInt(f1[0]) - 1);
                vertexIndices.push(parseInt(f2[0]) - 1);
                vertexIndices.push(parseInt(f3[0]) - 1);
            } 
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(vertexIndices);
        geometry.computeVertexNormals();

        
        let material: THREE.MeshBasicMaterial;
        if (mtlFileName) {
            const color = await this.readMaterialFile(mtlFileName);
            material = new THREE.MeshBasicMaterial({ color: color });
        } 

        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
    }
    
}

async function readFile(path): Promise<string> {
    return new Promise((resolve => {
        const loader = new THREE.FileLoader();
        loader.load(path, (data) => {
                if(typeof data === "string") {
                    resolve(data);
                } else {
                    const decoder = new TextDecoder('utf-8');
                    const decodedString = decoder.decode(data);
                    resolve(decodedString);
                }
            },
        );
    }));
}


window.addEventListener("DOMContentLoaded", init);

async function init() { 
    let container = new ThreeJSContainer();

    let viewport = await container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 3)); 
    document.body.appendChild(viewport);
}
