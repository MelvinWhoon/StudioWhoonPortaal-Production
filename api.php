if ($action === 'create_user') {
    $data = json_decode(file_get_contents('php://input'), true);

    $email = trim($data['email'] ?? '');
    $first_name = trim($data['first_name'] ?? '');
    $last_name = trim($data['last_name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $role = trim($data['role'] ?? 'CUSTOMER');
    $password = $data['password'] ?? '';
    $is_active = isset($data['is_active']) ? (bool)$data['is_active'] : true;
    $case_number = trim($data['case_number'] ?? '');
    $plot_number = trim($data['plot_number'] ?? '');
    $project_id = !empty($data['project_id']) ? $data['project_id'] : null;
    $apartment_id = !empty($data['apartment_id']) ? $data['apartment_id'] : null;
    $master_package_id = !empty($data['master_package_id']) ? $data['master_package_id'] : null;

    if (!$email || !$first_name || !$last_name || !$password) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Email, voornaam, achternaam en wachtwoord zijn verplicht.'
        ]);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Ongeldig e-mailadres.'
        ]);
        exit;
    }

    $allowed_roles = ['SUPER_ADMIN', 'PROJECT_ADMIN', 'CUSTOMER'];
    if (!in_array($role, $allowed_roles, true)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Ongeldige rol.'
        ]);
        exit;
    }

    $checkStmt = $pdo->prepare("SELECT id FROM public.users WHERE email = :email LIMIT 1");
    $checkStmt->execute(['email' => $email]);

    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'Deze gebruiker bestaat al.'
        ]);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    $fullName = trim($first_name . ' ' . $last_name);

    $stmt = $pdo->prepare("
        INSERT INTO public.users (
            email,
            name,
            role,
            password,
            is_active,
            is_password_set,
            project_id,
            apartment_id,
            master_package_id,
            first_name,
            last_name,
            phone,
            case_number,
            plot_number
        ) VALUES (
            :email,
            :name,
            :role,
            :password,
            :is_active,
            :is_password_set,
            :project_id,
            :apartment_id,
            :master_package_id,
            :first_name,
            :last_name,
            :phone,
            :case_number,
            :plot_number
        )
        RETURNING id
    ");

    $stmt->execute([
        'email' => $email,
        'name' => $fullName,
        'role' => $role,
        'password' => $hashedPassword,
        'is_active' => $is_active,
        'is_password_set' => true,
        'project_id' => $project_id,
        'apartment_id' => $apartment_id,
        'master_package_id' => $master_package_id,
        'first_name' => $first_name,
        'last_name' => $last_name,
        'phone' => $phone,
        'case_number' => $case_number,
        'plot_number' => $plot_number
    ]);

    $newUser = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'message' => 'Gebruiker succesvol aangemaakt.',
        'user_id' => $newUser['id'] ?? null
    ]);
    exit;
}

if ($action === 'send_mail') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    if (!$email || !$password) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Email en wachtwoord zijn verplicht.']);
        exit;
    }
    
    $subject = "Uw account voor Global Interior Concepts is aangemaakt";
    $message = "Beste klant,\n\nUw account is succesvol aangemaakt.\n\nU kunt inloggen via: https://www.globalinteriorconcepts.com/\n\nUw inloggegevens:\nE-mailadres: $email\nWachtwoord: $password\n\nMet vriendelijke groet,\nGlobal Interior Concepts";
    $headers = "From: no-reply@globalinteriorconcepts.com\r\n";
    $headers .= "Reply-To: info@globalinteriorconcepts.com\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();
    
    $mailSent = mail($email, $subject, $message, $headers);
    
    if ($mailSent) {
        echo json_encode(['success' => true, 'message' => 'E-mail succesvol verzonden.']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Fout bij verzenden van e-mail.']);
    }
    exit;
}