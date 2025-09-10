#!/bin/bash
# Bootstrap K3s cluster after Terraform creates the infrastructure
# This script runs AFTER Terraform creates servers but provisioners fail

set -e

echo "Bootstrapping K3s cluster..."

# Get server IPs from Hetzner
CONTROL_PLANE_IPS=$(hcloud server list -o columns=name,ipv4 | grep control-plane | awk '{print $2}')
AGENT_IPS=$(hcloud server list -o columns=name,ipv4 | grep -E "agent|egress" | awk '{print $2}')

# Get the first control plane as the initial server
FIRST_CONTROL_PLANE=$(echo "$CONTROL_PLANE_IPS" | head -1)

echo "Installing K3s on first control plane: $FIRST_CONTROL_PLANE"

# Install K3s on first control plane
ssh -o StrictHostKeyChecking=no root@$FIRST_CONTROL_PLANE << 'EOF'
curl -sfL https://get.k3s.io | sh -s - server \
  --cluster-init \
  --disable traefik \
  --disable servicelb \
  --disable-cloud-controller \
  --disable local-storage \
  --node-name $(hostname -f) \
  --tls-san $(curl -s https://ipv4.icanhazip.com)
EOF

# Get the token
TOKEN=$(ssh -o StrictHostKeyChecking=no root@$FIRST_CONTROL_PLANE "cat /var/lib/rancher/k3s/server/node-token")

# Join other control planes
for IP in $(echo "$CONTROL_PLANE_IPS" | tail -n +2); do
  echo "Joining control plane: $IP"
  ssh -o StrictHostKeyChecking=no root@$IP << EOF
curl -sfL https://get.k3s.io | sh -s - server \
  --server https://$FIRST_CONTROL_PLANE:6443 \
  --token $TOKEN \
  --disable traefik \
  --disable servicelb \
  --disable-cloud-controller \
  --disable local-storage \
  --node-name \$(hostname -f)
EOF
done

# Join agents
for IP in $AGENT_IPS; do
  echo "Joining agent: $IP"
  ssh -o StrictHostKeyChecking=no root@$IP << EOF
curl -sfL https://get.k3s.io | sh -s - agent \
  --server https://$FIRST_CONTROL_PLANE:6443 \
  --token $TOKEN \
  --node-name \$(hostname -f)
EOF
done

# Get kubeconfig
echo "Fetching kubeconfig..."
ssh -o StrictHostKeyChecking=no root@$FIRST_CONTROL_PLANE "cat /etc/rancher/k3s/k3s.yaml" | \
  sed "s/127.0.0.1/$FIRST_CONTROL_PLANE/g" > ~/.kube/config

echo "K3s cluster bootstrapped successfully!"
kubectl get nodes