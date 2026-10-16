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