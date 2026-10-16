stage('Build & Push to Docker Hub') {
            steps {
                script {
                    // Build the Docker image locally on your Jenkins container (which has access via the Docker pipe)
                    sh "docker build -t suregopinath/adhikar:latest ."
                    
                    // Uncomment below once you are ready to push to Docker Hub
                    // sh "docker push suregopinath/adhikar:latest"
                }
            }
        }