#!/bin/bash

# Script pour résoudre les problèmes de permissions docker.sock dans les devcontainers
# Ce script vérifie et corrige les permissions sur /var/run/docker.sock

set -e

echo "Vérification des permissions docker.sock..."

# Vérifier si docker.sock existe
if [ ! -e /var/run/docker.sock ]; then
    echo "ERREUR: /var/run/docker.sock n'existe pas"
    echo "Solution: Assurez-vous que Docker Desktop est en cours d'exécution"
    echo "         et que le devcontainer a accès au socket Docker"
    exit 1
fi

# Afficher les permissions actuelles
echo "Permissions actuelles:"
ls -al /var/run/docker.sock

# Vérifier les permissions actuelles
current_perms=$(stat -c "%a" /var/run/docker.sock 2>/dev/null || echo "000")
echo "Permissions numériques actuelles: $current_perms"

# Vérifier si l'utilisateur actuel appartient au groupe docker
if groups | grep -q docker; then
    echo "OK: L'utilisateur actuel appartient au groupe docker"
else
    echo "INFO: L'utilisateur actuel n'appartient pas au groupe docker"
    echo "      (Ceci peut être normal dans un devcontainer)"
fi

# Vérifier si nous pouvons accéder au socket Docker
if docker version >/dev/null 2>&1; then
    echo "OK: Docker est accessible"
    echo "Version Docker:"
    docker version --format "{{.Client.Version}}"
else
    echo "PROBLEME: Docker n'est pas accessible"
    echo "Tentative de correction des permissions..."
    
    # Vérifier si nous avons les privilèges sudo
    if sudo -n true 2>/dev/null; then
        echo "Application de chmod 666 sur /var/run/docker.sock..."
        sudo chmod 666 /var/run/docker.sock
        
        echo "Nouvelles permissions:"
        ls -al /var/run/docker.sock
        
        # Vérifier à nouveau l'accès Docker
        if docker version >/dev/null 2>&1; then
            echo "SUCCES: Docker est maintenant accessible"
            echo "Version Docker:"
            docker version --format "{{.Client.Version}}"
        else
            echo "ECHEC: Docker n'est toujours pas accessible après correction"
            echo "Solutions supplémentaires à essayer:"
            echo "  1. Redémarrer Docker Desktop"
            echo "  2. Reconstruire le devcontainer"
            echo "  3. Vérifier la configuration des volumes dans devcontainer.json"
        fi
    else
        echo "ERREUR: Impossible d'utiliser sudo pour corriger les permissions"
        echo "Solutions à essayer:"
        echo "  1. Exécuter manuellement: sudo chmod 666 /var/run/docker.sock"
        echo "  2. Ajouter l'utilisateur au groupe docker sur l'hôte"
        echo "  3. Redémarrer Docker Desktop"
        echo "  4. Vérifier la configuration du devcontainer"
    fi
fi

# Vérifier si testcontainers peut fonctionner
echo ""
echo "Test de compatibilité avec testcontainers..."
if command -v node >/dev/null 2>&1; then
    node -e "
        try {
            const { TestContainer } = require('@testcontainers/testcontainers');
            console.log('OK: Module testcontainers trouvé');
        } catch (e) {
            console.log('WARNING: Module testcontainers non trouvé (npm install requis)');
        }
    " 2>/dev/null || echo "INFO: Node.js disponible, mais testcontainers non installé"
else
    echo "INFO: Node.js non disponible dans ce contexte"
fi

echo ""
echo "RESUME - Solutions pour testcontainers + devcontainer:"
echo "  1. Permissions docker.sock: chmod 666 /var/run/docker.sock"
echo "  2. Configuration devcontainer.json avec le bon montage du socket:"
echo '     "mounts": ["source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"]'
echo "  3. Utilisateur dans le groupe docker (optionnel)"
echo "  4. Docker Desktop en cours d'exécution sur l'hôte"
echo ""
echo "Script terminé"