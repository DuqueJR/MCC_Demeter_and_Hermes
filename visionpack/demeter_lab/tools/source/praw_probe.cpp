#include <iostream>
#include <string>

// Dependiendo de cómo esté estructurado src/ en tu clon, el header puede variar.
// Declaramos el prototipo basándonos en el símbolo exportado que encontramos.
namespace libpisp {
    // Retorna la estructura pisp_image_format_config u oculta
    uint32_t get_pisp_image_format(const std::string& name); 
}

int main() {
    const char* formats[] = {
        "BGGR_PISP_COMP1",
        "PC1B",
        "PISP_COMP1_BGGR",
        "bggr_pisp_comp1",
        "SBGGR10",
        "SBGGR12",
        "RGB888",
        "YUV420P"
    };

    std::cout << "--- PROBANDO FORMATOS INTERNOS DE LIBPISP ---" << std::endl;

    for (const auto& f : formats) {
        try {
            // Si la función lanza excepción o devuelve 0/invalido, lo atrapamos
            auto fmt = libpisp::get_pisp_image_format(f);
            std::cout << "[ OK ] " << f << " (Código interno detectado)" << std::endl;
        } catch (...) {
            std::cout << "[FAIL] " << f << std::endl;
        }
    }
    return 0;
}
