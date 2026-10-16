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
                sh 'docker build -t suregopinath/adhikar:latest .'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully and all tests passed!'
        }
        failure {
            echo 'Pipeline failed during tests or build stage.'
        }
    }
}