pipeline {
    agent any

    tools {
        // Make sure you have a Node.js tool installation named 'Node24' configured in Jenkins
        nodejs 'Node24'
    }

    environment {
        // Replace with your Docker Hub credentials ID configured in Jenkins
        DOCKER_CREDENTIALS_ID = 'docker-hub-credentials'
        IMAGE_NAME = 'gopinath3008/adhikar-app'
    }

    stages {
        stage('Checkout') {
            steps {
                // Checks out your code repository
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                // Clean install dependencies using npm
                sh 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                // Executes your application tests
                sh 'npm test'
            }
        }

        stage('Build & Push to Docker Hub') {
            steps {
                script {
                    // Log in to Docker Hub using stored Jenkins credentials
                    docker.withRegistry('https://index.docker.io/v1/', "${env.DOCKER_CREDENTIALS_ID}") {
                        // Build the Docker image tagged initially with the Jenkins build number
                        def appImage = docker.build("${env.IMAGE_NAME}:run-${env.BUILD_NUMBER}")
                        
                        // Push multiple dynamic tags for version traceability
                        appImage.push("run-${env.BUILD_NUMBER}")
                        appImage.push("latest")
                        
                        // If running inside a Git context, you can also tag with the commit hash, 
                        // or fallback to the build number if BUILD_ID is used.
                        if (env.GIT_COMMIT) {
                            appImage.push("${env.GIT_COMMIT}")
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully! Docker image pushed with multiple tags.'
        }
        failure {
            echo 'Pipeline failed during tests or build stage.'
        }
    }
}