pipeline {
    agent any

    tools {
        nodejs 'Node24'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build & Push to Docker Hub') {
            steps {
                script {
                    sh "echo 'Building Docker image...'"
                    sh "docker build -t gopinath3008/adhikar-app:latest ."
                    
                    withCredentials([usernamePassword(credentialsId: 'Docker_Credentials', 
                                                      usernameVariable: 'DOCKER_USER', 
                                                      passwordVariable: 'DOCKER_PASS')]) {
                        sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                        sh "docker push gopinath3008/adhikar-app:latest"
                    }
                }
            }
        }
        stage('Deploy') {
            steps {
                script {
                    // Stop and remove the old container if it exists, then run the new one
                    sh 'docker stop adhikar-app-container || true'
                    sh 'docker rm adhikar-app-container || true'
                    
                    // Pull the latest image and run it on port 3000
                    sh 'docker pull gopinath3008/adhikar-app:latest'
                    sh 'docker run -d --name adhikar-app-container -p 3000:3000 gopinath3008/adhikar-app:latest'
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully, all tests passed, and image pushed!'
        }
        failure {
            echo 'Pipeline failed.'
        }
    }
}