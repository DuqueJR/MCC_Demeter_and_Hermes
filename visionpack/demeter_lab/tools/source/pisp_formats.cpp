#include <iostream>
#include <string>
#include <stdint.h>

#include "libpisp/common/utils.hpp"

int main()
{
    const char* formats[] =
    {
        "BGGR_PISP_COMP1",
	"PISP_COMP1",
	"PISP_COMP2",
	"PISP_COMP3",
	"PISP_COMP0",
        "PC1B",
        "SBGGR10",
        "SBGGR12",
        "RGB888",
        "YUV420P"
    };

    for (auto f : formats)
    {
        try
        {
            auto v = libpisp::get_pisp_image_format(f);

            std::cout
                << f
                << " -> 0x"
                << std::hex
                << v
                << std::dec
                << std::endl;
        }
        catch (...)
        {
            std::cout
                << f
                << " -> FAIL"
                << std::endl;
        }
    }
}
