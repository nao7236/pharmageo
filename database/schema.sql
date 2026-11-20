-- Script de création de la base de données pour la plateforme de pharmacie
CREATE DATABASE IF NOT EXISTS pharmacie_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pharmacie_db;

-- Table des Utilisateurs
CREATE TABLE utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telephone VARCHAR(20),
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    role ENUM('PATIENT', 'PHARMACIEN', 'ADMIN') NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des Pharmacies
CREATE TABLE pharmacies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    adresse TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    telephone VARCHAR(20),
    horaires_json JSON,
    est_de_garde BOOLEAN DEFAULT FALSE,
    statut_agrement ENUM('EN_ATTENTE', 'VALIDE', 'REJETE') DEFAULT 'EN_ATTENTE',
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Table des Médicaments
CREATE TABLE medicaments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom_commercial VARCHAR(150) NOT NULL,
    dci VARCHAR(150),
    dosage VARCHAR(50),
    forme_galenique VARCHAR(50),
    prix_indicatif DECIMAL(10, 2),
    ordonnance_requise BOOLEAN DEFAULT FALSE
);

-- Table des Stocks
CREATE TABLE stocks_pharmacie (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pharmacie_id INT NOT NULL,
    medicament_id INT NOT NULL,
    quantite_disponible INT DEFAULT 0,
    seuil_alerte INT DEFAULT 5,
    date_maj TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pharmacie_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id) ON DELETE CASCADE
);

-- Table des Précommandes
CREATE TABLE precommandes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    pharmacie_id INT NOT NULL,
    statut ENUM('EN_ATTENTE', 'VALIDEE', 'PREPARATION', 'PRETE', 'RETRIEE', 'REFUSEE') DEFAULT 'EN_ATTENTE',
    url_ordonnance VARCHAR(255),
    code_retrait VARCHAR(10) UNIQUE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_expiration DATETIME,
    FOREIGN KEY (patient_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (pharmacie_id) REFERENCES pharmacies(id) ON DELETE CASCADE
);

-- Table des Lignes de Précommande
CREATE TABLE lignes_precommande (
    id INT AUTO_INCREMENT PRIMARY KEY,
    precommande_id INT NOT NULL,
    medicament_id INT NOT NULL,
    quantite INT NOT NULL,
    FOREIGN KEY (precommande_id) REFERENCES precommandes(id) ON DELETE CASCADE,
    FOREIGN KEY (medicament_id) REFERENCES medicaments(id) ON DELETE CASCADE
);

-- Index spatial pour la géolocalisation
ALTER TABLE pharmacies ADD SPATIAL INDEX (latitude, longitude);
