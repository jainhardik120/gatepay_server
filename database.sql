CREATE TABLE Users (
    ID UUID PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    DateOfBirth DATE,
    Address VARCHAR(255),
    Balance DECIMAL(10, 2) DEFAULT 0.0,
    Email VARCHAR(255) UNIQUE NOT NULL,
    PhoneNumber VARCHAR(15),
    AlternateEmergencyContact VARCHAR(255),
    Password VARCHAR(255) NOT NULL,
    NewUserLandingCompleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE Vehicle (
    ID UUID PRIMARY KEY,
    UserID UUID REFERENCES Users(ID),
    Type VARCHAR(255),
    VehicleNo VARCHAR(255),
    Manufacturer VARCHAR(255),
    Model VARCHAR(255),
    Color VARCHAR(255)
);

CREATE TABLE TollsAndParkingSpaces (
    ID UUID PRIMARY KEY,
    Type VARCHAR(255),
    LocationIdentifier VARCHAR(255),
    Name VARCHAR(255),
    Balance DECIMAL(10, 2),
    AvailabilityStatus VARCHAR(50)
);

CREATE TABLE UserTransactions (
    TransactionID UUID PRIMARY KEY,
    OrderID UUID,
    PaymentID UUID,
    SecureHash VARCHAR(255),
    Date TIMESTAMP,
    UserID UUID REFERENCES Users(ID),
    Amount DECIMAL(10, 2),
    StartBalance DECIMAL(10, 2),
    EndBalance DECIMAL(10, 2),
    TransactionType VARCHAR(255),
    Status VARCHAR(50),
    TOLPARID UUID REFERENCES TollsAndParkingSpaces(ID)
);