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
                    sh "docker build -t gopinath3008/adhikar-app:latest ."
                }
            }
        }

        stage('Security Scan') {
            steps {
                script {
                    echo 'Scanning image with Trivy (blocking only CRITICAL vulnerabilities)...'
                    
                    sh '''
                        docker run --rm aquasec/trivy:latest image \
                            --scanners vuln \
                            --severity CRITICAL \
                            --exit-code 1 \
                            gopinath3008/adhikar-app:latest
                    '''
                }
            }
        }

        stage('Build & Push to Docker Hub') {
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
        stage('Smoke Test') {
            steps {
                script {
                    echo 'Waiting for application health check to pass...'
                    
                    // Added #!/bin/bash at the top so the loop and brace expansion work properly
                    sh '''#!/bin/bash
                        for i in {1..10}; do
                            HEALTH_STATUS=$(docker inspect --format=\'{{.State.Health.Status}}\' adhikar-app-container 2>/dev/null || echo "starting")
                            echo "Attempt $i: Container health status is [$HEALTH_STATUS]"
                            
                            if [ "$HEALTH_STATUS" = "healthy" ]; then
                                echo "Smoke test passed! Application is live and healthy."
                                exit 0
                            elif [ "$HEALTH_STATUS" = "unhealthy" ]; then
                                echo "Smoke test failed! Container reported unhealthy."
                                exit 1
                            fi
                            
                            sleep 3
                        done
                        
                        echo "Smoke test timed out waiting for health check."
                        exit 1
                    '''
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