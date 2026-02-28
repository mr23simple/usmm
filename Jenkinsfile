// USMM - Social Media Manager
// Deploys to: OCI web-server (138.2.50.218)

pipeline {
    agent any
    
    tools {
        nodejs 'nodejs'
        jdk 'jdk17'
    }
    
    environment {
        TARGET_SERVER = '138.2.50.218'
        TARGET_PATH = '/var/www/usmm'
        SERVICE_NAME_1 = 'usmm'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 20, unit: 'MINUTES')
        timestamps()
    }
    
    stages {
        stage('Checkout and Build') {
            steps {
                echo 'Checking out and building USMM...'
                checkout scm
                sh 'pnpm --version || npm install -g pnpm'
                sh 'pnpm install --frozen-lockfile --ignore-scripts'
                sh 'npx tsc --noEmit || true'
                sh 'pnpm run build'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'sonar-scanner-4.0'
                    withSonarQubeEnv('sonarqube') {
                        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                            sh "${scannerHome}/bin/sonar-scanner \
                                -Dsonar.projectKey=usmm \
                                -Dsonar.projectName=USMM \
                                -Dsonar.sources=src \
                                -Dsonar.tests=tests \
                                -Dsonar.test.inclusions=tests/**/*.ts \
                                -Dsonar.exclusions=node_modules/**,dist/** \
                                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                                -Dsonar.token=${SONAR_TOKEN}"
                        }
                    }
                    timeout(time: 5, unit: 'MINUTES') {
                        waitForQualityGate abortPipeline: true
                    }
                }
            }
        }
        
        stage('Deploy to Production') {
            steps {
                echo 'Deploying USMM to production...'
                withCredentials([usernamePassword(credentialsId: 'github-rtxrs', passwordVariable: 'GITHUB_TOKEN', usernameVariable: 'GITHUB_USER')]) {
                    sshagent(['oci-web-server']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ubuntu@${TARGET_SERVER} "
                                sudo bash <<'EOF'
                                    # 1. Setup the environment (Literal values)
                                    export NODE_BIN_DIR='/root/.nvm/versions/node/v24.13.0/bin'
                                    export PNPM_BIN_DIR='/root/.local/share/pnpm'
                                    
                                    # 2. Update PATH (Use \\\\\\\$ to escape for Groovy AND Shell)
                                    export PATH=\\\$NODE_BIN_DIR:\\\$PNPM_BIN_DIR:\\\$PATH
                                    
                                    # 3. Navigate and pull
                                    cd /var/www/usmm
                                    git config --global --add safe.directory /var/www/usmm
                                    git pull https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/rtxrs/usmm.git main
                                    
                                    # 4. Execute commands
                                    pnpm install
                                    pnpm run build
                                    
                                    # 5. Restart or Start Services
                                    pm2 delete usmm || true
                                    pm2 start ecosystem.config.cjs
                                    pm2 save
EOF
                                    "
                                    """
                                    }                }
            }
        }
    }
    
    post {
        success {
            echo 'USMM build and deployment completed!'
        }
        failure {
            echo 'USMM build failed!'
        }
    }
}
