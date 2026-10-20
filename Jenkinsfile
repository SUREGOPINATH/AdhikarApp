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

        stage('Build Docker Image') {
            steps {
                script {
                    sh "echo 'Building Docker image...'"
                    sh "docker build --no-cache -t gopinath3008/adhikar-app:latest ."
                }
            }
        }

        stage('Push Image to Docker Hub') {
            steps {
                script {
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
            echo '🎉 Pipeline completed successfully! Image pushed to Docker Hub.'
            echo 'Run: multipass exec devops-server -- /home/ubuntu/update-app.sh to deploy.'
        }
        failure {
            echo '❌ Pipeline failed during execution.'
        }
    }
}