import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const groundRay = new THREE.Raycaster();
const downDirection = new THREE.Vector3(0, -1, 0);

export class TPSControls {
    private model: THREE.Object3D;
    private mixer: THREE.AnimationMixer;
    private animationsMap: Map<string, THREE.AnimationAction>;
    private orbitControl: OrbitControls;
    private camera: THREE.PerspectiveCamera;
    private y: number = 0;
    private toggleRun: boolean = true;
    private currentAction: string;
    private walkDirection = new THREE.Vector3();
    private rotateAngle = new THREE.Vector3(0, 1, 0);
    private rotateQuaternion: THREE.Quaternion = new THREE.Quaternion();
    private cameraTarget = new THREE.Vector3();
    private fadeDuration: number = 0.2;
    private runVelocity: number = 7;

    constructor(
        model: THREE.Object3D,
        mixer: THREE.AnimationMixer,
        animationsMap: Map<string, THREE.AnimationAction>,
        orbitControl: OrbitControls,
        camera: THREE.PerspectiveCamera,
        currentAction: string,
    ) {
        this.model = model;
        this.mixer = mixer;
        this.animationsMap = animationsMap;
        this.currentAction = currentAction;
        this.orbitControl = orbitControl;
        this.camera = camera;
        this.animationsMap.forEach((value, key) => {
            if (key == currentAction) value.play();
        });
        this.updateTarget();
    }

    public switchRunToggle() {
        this.toggleRun = !this.toggleRun;
    }

    public getPosition() {
        return this.model.position;
    }

    public update(delta: number, joystickDirection: { x: number; y: number }, groundMesh: THREE.Mesh) {
        const directionPressed = joystickDirection.x !== 0 || joystickDirection.y !== 0;
        const characterPosition = this.getPosition();
        const rayPosition = characterPosition.clone();
        rayPosition.y += 1.5;
        groundRay.set(rayPosition, downDirection);
        const intersects = groundRay.intersectObject(groundMesh, true);
        let y = this.y;
        if (intersects.length > 0) {
            y = intersects[0].point.y;
            this.y = y;
        }

        // アニメーション切り替え
        let play = directionPressed && this.toggleRun ? 'run' : 'idle';
        if (this.currentAction != play) {
            const toPlay = this.animationsMap.get(play);
            const current = this.animationsMap.get(this.currentAction);
            if (!current || !toPlay) return;
            current.fadeOut(this.fadeDuration);
            toPlay.reset().fadeIn(this.fadeDuration).play();
            this.currentAction = play;
        }

        this.mixer.update(delta);

        if (this.currentAction == 'run') {
            const angleYCameraDirection = Math.atan2(
                this.camera.position.x - this.model.position.x,
                this.camera.position.z - this.model.position.z
            );
            this.walkDirection.set(joystickDirection.x, 0, -joystickDirection.y);
            this.walkDirection.normalize();
            this.walkDirection.applyAxisAngle(this.rotateAngle, angleYCameraDirection);
            const velocity = this.runVelocity;
            const moveDistance = velocity * delta;
            const moveAngle = Math.atan2(this.walkDirection.x, this.walkDirection.z);
            this.rotateQuaternion.setFromAxisAngle(this.rotateAngle, moveAngle);
            this.model.quaternion.rotateTowards(this.rotateQuaternion, 0.2);
            this.model.position.x += this.walkDirection.x * moveDistance;
            this.model.position.z += this.walkDirection.z * moveDistance;
            this.model.position.y = y;
            this.updateTarget();
        }
    }

    private updateTarget() {
        const cameraOffset = new THREE.Vector3().subVectors(this.camera.position, this.orbitControl.target);
        const modelY = this.model.position.y;
        this.cameraTarget.set(
            this.model.position.x,
            modelY + 1,
            this.model.position.z,
        );
        this.camera.position.copy(this.cameraTarget).add(cameraOffset);
        this.orbitControl.target.copy(this.cameraTarget);
        this.orbitControl.update();
        this.camera.updateProjectionMatrix();
    }
}