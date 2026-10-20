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

        stage('Deploy to Remote Server') {
            steps {
                script {
                    echo 'Transferring docker-compose to devops-server via SCP...'
                    
                    // Note: If your Jenkins container needs an SSH key, you can mount it or use credentials. 
                    // For local testing, we can use sshpass or standard scp with strict key checking disabled.
                    sh '''
                        # Ensure sshpass or ssh client is available, then copy the file
                        scp -o StrictHostKeyChecking=no docker-compose.yml ubuntu@172.17.0.1:/home/ubuntu/docker-compose.yml
                    '''
                    
                    echo 'Deploying application via Docker Compose on remote server...'
                    sh '''
                        ssh -o StrictHostKeyChecking=no ubuntu@172.17.0.1 '
                            docker compose -f /home/ubuntu/docker-compose.yml pull &&
                            docker compose -f /home/ubuntu/docker-compose.yml up -d --force-recreate
                        '
                    '''
                }
            }
        }

        stage('Smoke Test Remote Container') {
            steps {
                script {
                    echo 'Waiting for health check on remote devops-server...'
                    
                    sh '''#!/bin/bash
                        for i in {1..10}; do
                            HEALTH_STATUS=$(ssh -o StrictHostKeyChecking=no ubuntu@172.17.0.1 "docker inspect --format='{{.State.Health.Status}}' adhikar-app 2>/dev/null || echo 'starting'")
                            echo "Attempt $i: Remote container health status is [$HEALTH_STATUS]"
                            
                            if [ "$HEALTH_STATUS" = "healthy" ]; then
                                echo "Remote smoke test passed! Application is live and healthy on devops-server."
                                exit 0
                            elif [ "$HEALTH_STATUS" = "unhealthy" ]; then
                                echo "Smoke test failed! Remote container reported unhealthy."
                                exit 1
                            fi
                            
                            sleep 3
                        done
                        
                        echo "Smoke test timed out waiting for remote container health check."
                        exit 1
                    '''
                }
            }
        }    }

    post {
        success {
            echo '🎉 Pipeline completed successfully, image pushed, and deployed to devops-server!'
        }
        failure {
            echo '❌ Pipeline failed during execution.'
        }
    }
}